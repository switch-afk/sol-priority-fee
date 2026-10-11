'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { watchLoop, wait } = require('../src/watch');
const { RpcError } = require('../src/rpc');

function capture() {
  const lines = { out: [], err: [] };
  return {
    lines,
    io: {
      out: (text) => lines.out.push(text),
      err: (text) => lines.err.push(text),
    },
  };
}

// A wait() stand-in that returns at once and aborts the loop after `count` waits.
function stopAfter(count) {
  const controller = new AbortController();
  const waits = [];
  return {
    signal: controller.signal,
    waits,
    waitImpl: async (ms) => {
      waits.push(ms);
      if (waits.length >= count) controller.abort();
    },
  };
}

test('wait resolves after the delay', async () => {
  const start = Date.now();
  await wait(20);
  assert.ok(Date.now() - start >= 10);
});

test('wait ends early when the signal aborts, and at once if already aborted', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  const start = Date.now();
  await wait(60000, controller.signal);
  assert.ok(Date.now() - start < 5000);
  await wait(60000, controller.signal);
});

test('watchLoop refreshes on every interval until the signal aborts', async () => {
  let calls = 0;
  const stop = stopAfter(3);
  const { io } = capture();
  const code = await watchLoop({
    refresh: async () => {
      calls++;
    },
    intervalMs: 1234,
    signal: stop.signal,
    wait: stop.waitImpl,
    io,
  });
  assert.equal(code, 0);
  assert.equal(calls, 3);
  assert.deepEqual(stop.waits, [1234, 1234, 1234]);
});

test('watchLoop reports failures, keeps going and prints the hint once per streak', async () => {
  let calls = 0;
  const stop = stopAfter(4);
  const { lines, io } = capture();
  const code = await watchLoop({
    refresh: async () => {
      calls++;
      if (calls <= 2) throw new RpcError('boom', { hint: 'try later' });
    },
    intervalMs: 10,
    signal: stop.signal,
    wait: stop.waitImpl,
    io,
  });
  assert.equal(code, 0);
  assert.equal(calls, 4);
  assert.deepEqual(lines.err, ['error: boom', 'try later', 'error: boom']);
});

test('watchLoop gives up after 5 failed refreshes in a row', async () => {
  let calls = 0;
  const controller = new AbortController();
  const { lines, io } = capture();
  const code = await watchLoop({
    refresh: async () => {
      calls++;
      throw new RpcError('nope');
    },
    intervalMs: 10,
    signal: controller.signal,
    wait: async () => {},
    io,
  });
  assert.equal(code, 1);
  assert.equal(calls, 5);
  assert.equal(lines.err.filter((line) => line === 'error: nope').length, 5);
  assert.equal(lines.err[lines.err.length - 1], 'error: giving up after 5 failed refreshes in a row.');
});

test('watchLoop resets the failure streak after a success', async () => {
  const outcomes = 'FFFFSFFFFS';
  let calls = 0;
  const stop = stopAfter(10);
  const { lines, io } = capture();
  const code = await watchLoop({
    refresh: async () => {
      const outcome = outcomes[calls++];
      if (outcome === 'F') throw new RpcError('flaky');
    },
    intervalMs: 10,
    signal: stop.signal,
    wait: stop.waitImpl,
    io,
  });
  assert.equal(code, 0);
  assert.equal(calls, 10);
  assert.equal(lines.err.some((line) => /giving up/.test(line)), false);
});

test('watchLoop rethrows errors that are not RPC errors', async () => {
  const controller = new AbortController();
  const { io } = capture();
  await assert.rejects(
    watchLoop({
      refresh: async () => {
        throw new TypeError('bug');
      },
      intervalMs: 10,
      signal: controller.signal,
      wait: async () => {},
      io,
    }),
    TypeError,
  );
});
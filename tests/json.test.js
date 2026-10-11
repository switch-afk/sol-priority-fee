'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeFees, summarizeAccountFees } = require('../src/fees');
const { blocksToJson, accountToJson } = require('../src/json');

const NOW = new Date('2026-10-11T12:00:00.000Z');

test('blocksToJson describes the recent-transactions recommendation', () => {
  const summary = summarizeFees({
    fees: [0, 0, 0, 100, 200, 300, 400, 500, 600, 1000],
    slots: [10, 11, 12],
  });
  const json = blocksToJson(summary, { host: 'rpc.example.com', now: NOW });

  assert.equal(json.mode, 'recent-transactions');
  assert.equal(json.time, '2026-10-11T12:00:00.000Z');
  assert.equal(json.rpc, 'rpc.example.com');
  assert.equal(json.computeUnits, 200000);
  assert.deepEqual(json.slotRange, { from: 10, to: 12 });
  assert.equal(json.blockCount, 3);
  assert.equal(json.sampleCount, 10);
  assert.equal(json.payingCount, 7);
  assert.deepEqual(json.levels.low, { percentile: 50, lamports: 200, microLamportsPerUnit: 1000 });
  assert.deepEqual(json.levels.high, { percentile: 90, lamports: 600, microLamportsPerUnit: 3000 });
});

test('accountToJson describes the per-account fee floor', () => {
  const samples = [0, 0, 100, 200, 300, 400, 500, 600, 700, 800].map((fee, i) => ({
    slot: 10 + i,
    prioritizationFee: fee,
  }));
  const summary = summarizeAccountFees(samples);
  const json = accountToJson(summary, { host: 'rpc.example.com', now: NOW, accounts: ['A1', 'A2'] });

  assert.equal(json.mode, 'account-floor');
  assert.equal(json.time, '2026-10-11T12:00:00.000Z');
  assert.deepEqual(json.accounts, ['A1', 'A2']);
  assert.deepEqual(json.slotRange, { from: 10, to: 19 });
  assert.equal(json.sampleCount, 10);
  assert.equal(json.zeroCount, 2);
  assert.deepEqual(json.levels.low, { percentile: 50, lamports: 60, microLamportsPerUnit: 300 });
});
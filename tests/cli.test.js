'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/cli');
const pkg = require('../package.json');
const { createMockRpc } = require('./helpers/mock-rpc');

const noWait = async () => {};
const PAID = [0, 0, 0, 100, 200, 300, 400, 500, 600, 1000];

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

function block() {
  return PAID.map((priority) => ({
    transaction: {
      accountKeys: [{ pubkey: 'Payer1111', signer: true, writable: true }],
      signatures: ['sig'],
    },
    meta: { fee: 5000 + priority },
  }));
}

function feeRoutes() {
  return {
    getSlot: { result: 1000 },
    getBlock: (params) => {
      if (params[0] === 995) {
        return { error: { code: -32007, message: 'Slot 995 was skipped, or missing due to ledger jump' } };
      }
      return { result: { transactions: block() } };
    },
  };
}

test('--help prints usage and exits 0', async () => {
  const { lines, io } = capture();
  const code = await run(['--help'], io);
  assert.equal(code, 0);
  assert.match(lines.out.join('\n'), /Usage:/);
  assert.match(lines.out.join('\n'), /--units/);
});

test('--version prints the package version', async () => {
  const { lines, io } = capture();
  const code = await run(['--version'], io);
  assert.equal(code, 0);
  assert.equal(lines.out[0], pkg.version);
});

test('unknown option exits 2 with a hint', async () => {
  const { lines, io } = capture();
  const code = await run(['--nope'], io);
  assert.equal(code, 2);
  assert.match(lines.err.join('\n'), /unknown option: --nope/);
  assert.match(lines.err.join('\n'), /--help/);
});

test('prints low, medium and high from what recent transactions paid', async () => {
  const fetchImpl = createMockRpc(feeRoutes());
  const { lines, io } = capture();
  const code = await run([], io, { env: {}, fetchImpl });
  assert.equal(code, 0);
  const out = lines.out.join('\n');
  assert.match(out, /low\s+200\s+1,000/);
  assert.match(out, /medium\s+500\s+2,500/);
  assert.match(out, /high\s+600\s+3,000/);
  assert.match(out, /Based on 30 non-vote transactions in 3 recent blocks \(slots 992 to 994\)/);
  assert.match(out, /70% of them paid a priority fee/);
});

test('shows only the RPC hostname, never the full URL', async () => {
  const endpoint = 'https://rpc.example.com/secret-key-123';
  const fetchImpl = createMockRpc(feeRoutes());
  const { lines, io } = capture();
  const code = await run([], io, { env: { SOL_PRIORITY_FEE_RPC: endpoint }, fetchImpl });
  assert.equal(code, 0);
  const out = lines.out.join('\n');
  assert.match(out, /rpc\.example\.com/);
  assert.doesNotMatch(out, /secret-key-123/);
  assert.equal(fetchImpl.calls[0].url, endpoint);
});

test('--rpc overrides the environment variable', async () => {
  const fetchImpl = createMockRpc(feeRoutes());
  const { io } = capture();
  await run(['--rpc', 'https://custom.example.com/x'], io, {
    env: { SOL_PRIORITY_FEE_RPC: 'https://other.example.com' },
    fetchImpl,
  });
  assert.equal(fetchImpl.calls[0].url, 'https://custom.example.com/x');
});

test('--units changes the per-CU price', async () => {
  const fetchImpl = createMockRpc(feeRoutes());
  const { lines, io } = capture();
  const code = await run(['--units', '100000'], io, { env: {}, fetchImpl });
  assert.equal(code, 0);
  const out = lines.out.join('\n');
  assert.match(out, /low\s+200\s+2,000/);
  assert.match(out, /assumes a 100,000 compute unit limit/);
});

test('no usable transactions exits 1 with a clear message', async () => {
  const fetchImpl = createMockRpc({
    getSlot: { result: 1000 },
    getBlock: { result: { transactions: [] } },
  });
  const { lines, io } = capture();
  const code = await run([], io, { env: {}, fetchImpl });
  assert.equal(code, 1);
  assert.match(lines.err.join('\n'), /no usable transactions/);
});

test('rate limiting exits 1 with the own-RPC hint', async () => {
  const fetchImpl = createMockRpc({ getSlot: { status: 429 } });
  const { lines, io } = capture();
  const code = await run([], io, { env: {}, fetchImpl, sleepImpl: noWait });
  assert.equal(code, 1);
  const err = lines.err.join('\n');
  assert.match(err, /rate-limiting/);
  assert.match(err, /SOL_PRIORITY_FEE_RPC/);
});

test('options that are not built yet are refused clearly', async () => {
  const { lines, io } = capture();
  const code = await run(['--json'], io, { env: {} });
  assert.equal(code, 2);
  assert.match(lines.err.join('\n'), /--json not available yet/);
});
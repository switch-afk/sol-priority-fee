'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sampleRecentFees,
  extractPriorityFees,
  summarizeFees,
  percentile,
  computePriceMicroLamports,
} = require('../src/fees');
const { createMockRpc } = require('./helpers/mock-rpc');

const VOTE = 'Vote111111111111111111111111111111111111111';
const ENDPOINT = 'https://rpc.example.com';
const noWait = async () => {};

function tx({ fee, signatures = 1, vote = false, meta = true }) {
  const keys = [{ pubkey: 'Payer1111', signer: true, writable: true, source: 'transaction' }];
  if (vote) keys.push({ pubkey: VOTE, signer: false, writable: false, source: 'transaction' });
  return {
    transaction: {
      accountKeys: keys,
      signatures: Array.from({ length: signatures }, (_, i) => `sig${i}`),
    },
    meta: meta ? { fee } : null,
  };
}

function blockRoute(blocks) {
  return (params) => {
    const slot = params[0];
    if (blocks[slot]) return { result: { transactions: blocks[slot] } };
    return {
      error: {
        code: -32007,
        message: `Slot ${slot} was skipped, or missing due to ledger jump to recent snapshot`,
      },
    };
  };
}

test('percentile uses nearest rank', () => {
  const sorted = [1, 2, 3, 4];
  assert.equal(percentile(sorted, 50), 2);
  assert.equal(percentile(sorted, 75), 3);
  assert.equal(percentile(sorted, 100), 4);
  assert.equal(percentile(sorted, 0), 1);
  assert.equal(percentile([], 50), null);
});

test('computePriceMicroLamports converts a per-transaction fee to a per-CU price', () => {
  assert.equal(computePriceMicroLamports(447, 200000), 2235);
  assert.equal(computePriceMicroLamports(447, 50000), 8940);
  assert.equal(computePriceMicroLamports(1, 200000), 5);
  assert.equal(computePriceMicroLamports(0), 0);
});

test('extractPriorityFees skips votes and unreadable transactions and subtracts the base fee', () => {
  const result = extractPriorityFees([
    tx({ fee: 5000 }),
    tx({ fee: 6000 }),
    tx({ fee: 15000, signatures: 2 }),
    tx({ fee: 4000 }),
    tx({ fee: 5000, vote: true }),
    tx({ fee: 9999, meta: false }),
  ]);
  assert.deepEqual(result.fees, [0, 1000, 5000, 0]);
  assert.equal(result.voteCount, 1);
  assert.equal(result.unreadable, 1);
});

test('extractPriorityFees accepts plain string account keys', () => {
  const result = extractPriorityFees([
    { transaction: { accountKeys: ['Payer1111', VOTE], signatures: ['s'] }, meta: { fee: 5000 } },
  ]);
  assert.deepEqual(result.fees, []);
  assert.equal(result.voteCount, 1);
});

test('summarizeFees returns null when there are no fees', () => {
  assert.equal(summarizeFees({ fees: [], slots: [1] }), null);
  assert.equal(summarizeFees(null), null);
});

test('summarizeFees computes levels, per-CU prices and the paying count', () => {
  const sample = { fees: [800, 0, 100, 200, 300, 400, 500, 600, 700, 0], slots: [10, 12, 11] };
  const summary = summarizeFees(sample);
  assert.equal(summary.sampleCount, 10);
  assert.equal(summary.blockCount, 3);
  assert.deepEqual(summary.slotRange, { from: 10, to: 12 });
  assert.equal(summary.payingCount, 8);
  assert.equal(summary.max, 800);
  assert.equal(summary.computeUnits, 200000);
  assert.equal(summary.levels.low.lamports, 300);
  assert.equal(summary.levels.medium.lamports, 600);
  assert.equal(summary.levels.high.lamports, 700);
  assert.equal(summary.levels.low.microLamportsPerUnit, 1500);
  assert.equal(summary.levels.high.microLamportsPerUnit, 3500);

  const custom = summarizeFees(sample, { computeUnits: 100000 });
  assert.equal(custom.computeUnits, 100000);
  assert.equal(custom.levels.low.microLamportsPerUnit, 3000);
});

test('sampleRecentFees walks back past skipped slots and collects three blocks', async () => {
  const fetchImpl = createMockRpc({
    getSlot: { result: 1000 },
    getBlock: blockRoute({
      994: [tx({ fee: 6000 }), tx({ fee: 5000, vote: true })],
      993: [tx({ fee: 5200 })],
      992: [tx({ fee: 5000 })],
    }),
  });
  const sample = await sampleRecentFees(ENDPOINT, { rpcOptions: { fetchImpl } });

  assert.deepEqual([...sample.fees].sort((a, b) => a - b), [0, 200, 1000]);
  assert.deepEqual(sample.slots, [994, 993, 992]);
  assert.equal(sample.voteCount, 1);
  assert.equal(sample.unreadable, 0);

  const blockCalls = fetchImpl.calls.filter((call) => call.method === 'getBlock');
  assert.equal(blockCalls.length, 4);
  assert.equal(blockCalls[0].params[0], 995);
  assert.equal(blockCalls[0].params[1].transactionDetails, 'accounts');
  assert.equal(blockCalls[0].params[1].maxSupportedTransactionVersion, 1);
  assert.equal(blockCalls[0].params[1].rewards, false);
});

test('sampleRecentFees returns nothing when no block can be found', async () => {
  const fetchImpl = createMockRpc({
    getSlot: { result: 1000 },
    getBlock: blockRoute({}),
  });
  const sample = await sampleRecentFees(ENDPOINT, { rpcOptions: { fetchImpl } });
  assert.deepEqual(sample.fees, []);
  assert.deepEqual(sample.slots, []);
});

test('sampleRecentFees lets real RPC errors through', async () => {
  const fetchImpl = createMockRpc({
    getSlot: { result: 1000 },
    getBlock: { status: 429 },
  });
  await assert.rejects(
    sampleRecentFees(ENDPOINT, { rpcOptions: { fetchImpl, sleepImpl: noWait } }),
    (err) => {
      assert.equal(err.code, 'rate-limit');
      return true;
    },
  );
});
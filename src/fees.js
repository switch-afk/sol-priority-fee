'use strict';

const { rpcCall } = require('./rpc');

const VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111';
const BASE_FEE_LAMPORTS = 5000;
const DEFAULT_COMPUTE_UNITS = 200000;
const SAMPLE_BLOCKS = 3;
const FIRST_LOOKBACK = 5;
const MAX_LOOKBACK = 30;
const LEVEL_PERCENTILES = { low: 50, medium: 75, high: 90 };

function isMissingBlock(err) {
  return /skipped|not available/i.test(err.message);
}

// Walks back from the latest confirmed slot and collects recent blocks,
// skipping slots that have no block.
async function fetchRecentBlocks(endpoint, options = {}) {
  const { blocks = SAMPLE_BLOCKS, rpcOptions = {} } = options;
  const latest = await rpcCall(endpoint, 'getSlot', [{ commitment: 'confirmed' }], rpcOptions);
  const found = [];

  for (
    let back = FIRST_LOOKBACK;
    back < FIRST_LOOKBACK + MAX_LOOKBACK && found.length < blocks;
    back++
  ) {
    const slot = latest - back;
    try {
      const block = await rpcCall(
        endpoint,
        'getBlock',
        [
          slot,
          {
            encoding: 'json',
            transactionDetails: 'accounts',
            rewards: false,
            maxSupportedTransactionVersion: 1,
            commitment: 'confirmed',
          },
        ],
        rpcOptions,
      );
      if (block && Array.isArray(block.transactions)) {
        found.push({ slot, transactions: block.transactions });
      }
    } catch (err) {
      if (!isMissingBlock(err)) throw err;
    }
  }

  return found;
}

function pubkeyOf(key) {
  return typeof key === 'string' ? key : key && key.pubkey;
}

// Priority fee paid = total fee minus the base fee (5000 lamports per signature).
// Vote transactions are skipped: they are not part of the fee market.
function extractPriorityFees(transactions) {
  const fees = [];
  let voteCount = 0;
  let unreadable = 0;

  for (const tx of transactions) {
    const keys = tx && tx.transaction && tx.transaction.accountKeys;
    if (!Array.isArray(keys) || !tx.meta || !Number.isFinite(tx.meta.fee)) {
      unreadable++;
      continue;
    }
    if (keys.some((key) => pubkeyOf(key) === VOTE_PROGRAM)) {
      voteCount++;
      continue;
    }
    const signatures = (tx.transaction.signatures || []).length || 1;
    fees.push(Math.max(0, tx.meta.fee - BASE_FEE_LAMPORTS * signatures));
  }

  return { fees, voteCount, unreadable };
}

async function sampleRecentFees(endpoint, options = {}) {
  const blocks = await fetchRecentBlocks(endpoint, options);
  const fees = [];
  let voteCount = 0;
  let unreadable = 0;

  for (const block of blocks) {
    const extracted = extractPriorityFees(block.transactions);
    for (const fee of extracted.fees) fees.push(fee);
    voteCount += extracted.voteCount;
    unreadable += extracted.unreadable;
  }

  return { fees, slots: blocks.map((block) => block.slot), voteCount, unreadable };
}

// Per-slot fee reported by the RPC for landing a transaction that locks all of
// the given accounts as writable.
async function fetchAccountFees(endpoint, accounts, rpcOptions = {}) {
  const result = await rpcCall(endpoint, 'getRecentPrioritizationFees', [accounts], rpcOptions);
  if (!Array.isArray(result)) return [];
  return result.filter(
    (sample) =>
      sample &&
      Number.isFinite(sample.slot) &&
      Number.isFinite(sample.prioritizationFee),
  );
}

// Nearest-rank percentile on an ascending sorted array.
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return null;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  return sortedAsc[Math.max(rank, 1) - 1];
}

// A transaction that pays `lamports` of priority fee with a compute unit limit of
// `units` has a compute unit price of lamports * 1e6 / units micro-lamports.
function computePriceMicroLamports(lamports, units = DEFAULT_COMPUTE_UNITS) {
  return Math.ceil((lamports * 1e6) / units);
}

// The reverse: what a given compute unit price costs for `units` compute units.
function lamportsForPrice(microLamportsPerUnit, units = DEFAULT_COMPUTE_UNITS) {
  return Math.ceil((microLamportsPerUnit * units) / 1e6);
}

function summarizeFees(sample, options = {}) {
  const computeUnits = options.computeUnits || DEFAULT_COMPUTE_UNITS;
  if (!sample || sample.fees.length === 0) return null;

  const fees = [...sample.fees].sort((a, b) => a - b);

  const levels = {};
  for (const [name, p] of Object.entries(LEVEL_PERCENTILES)) {
    const lamports = percentile(fees, p);
    levels[name] = {
      percentile: p,
      lamports,
      microLamportsPerUnit: computePriceMicroLamports(lamports, computeUnits),
    };
  }

  return {
    sampleCount: fees.length,
    blockCount: sample.slots.length,
    slotRange: { from: Math.min(...sample.slots), to: Math.max(...sample.slots) },
    payingCount: fees.filter((fee) => fee > 0).length,
    max: fees[fees.length - 1],
    computeUnits,
    levels,
  };
}

function summarizeAccountFees(samples, options = {}) {
  const computeUnits = options.computeUnits || DEFAULT_COMPUTE_UNITS;
  if (!samples || samples.length === 0) return null;

  const fees = samples.map((sample) => sample.prioritizationFee).sort((a, b) => a - b);
  const slots = samples.map((sample) => sample.slot);

  const levels = {};
  for (const [name, p] of Object.entries(LEVEL_PERCENTILES)) {
    const microLamportsPerUnit = percentile(fees, p);
    levels[name] = {
      percentile: p,
      lamports: lamportsForPrice(microLamportsPerUnit, computeUnits),
      microLamportsPerUnit,
    };
  }

  return {
    sampleCount: samples.length,
    slotRange: { from: Math.min(...slots), to: Math.max(...slots) },
    zeroCount: fees.filter((fee) => fee === 0).length,
    max: fees[fees.length - 1],
    computeUnits,
    levels,
  };
}

module.exports = {
  fetchRecentBlocks,
  extractPriorityFees,
  sampleRecentFees,
  fetchAccountFees,
  percentile,
  computePriceMicroLamports,
  lamportsForPrice,
  summarizeFees,
  summarizeAccountFees,
  DEFAULT_COMPUTE_UNITS,
  LEVEL_PERCENTILES,
  BASE_FEE_LAMPORTS,
};
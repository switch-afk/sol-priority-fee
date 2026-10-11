'use strict';

const LEVEL_NAMES = ['low', 'medium', 'high'];

function levelsToJson(levels) {
  const out = {};
  for (const name of LEVEL_NAMES) {
    const level = levels[name];
    out[name] = {
      percentile: level.percentile,
      lamports: level.lamports,
      microLamportsPerUnit: level.microLamportsPerUnit,
    };
  }
  return out;
}

function blocksToJson(summary, { host, now }) {
  return {
    mode: 'recent-transactions',
    time: now.toISOString(),
    rpc: host,
    computeUnits: summary.computeUnits,
    slotRange: { from: summary.slotRange.from, to: summary.slotRange.to },
    blockCount: summary.blockCount,
    sampleCount: summary.sampleCount,
    payingCount: summary.payingCount,
    levels: levelsToJson(summary.levels),
  };
}

function accountToJson(summary, { host, now, accounts }) {
  return {
    mode: 'account-floor',
    time: now.toISOString(),
    rpc: host,
    accounts: [...accounts],
    computeUnits: summary.computeUnits,
    slotRange: { from: summary.slotRange.from, to: summary.slotRange.to },
    sampleCount: summary.sampleCount,
    zeroCount: summary.zeroCount,
    levels: levelsToJson(summary.levels),
  };
}

module.exports = { blocksToJson, accountToJson };
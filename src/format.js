'use strict';

const LEVEL_NAMES = ['low', 'medium', 'high'];

function formatInt(n) {
  return Number(n).toLocaleString('en-US');
}

function levelTable(levels) {
  const lines = [
    `  ${'level'.padEnd(8)}${'lamports/tx'.padStart(14)}${'micro-lamports/CU'.padStart(19)}`,
  ];
  for (const name of LEVEL_NAMES) {
    const level = levels[name];
    lines.push(
      `  ${name.padEnd(8)}${formatInt(level.lamports).padStart(14)}${formatInt(level.microLamportsPerUnit).padStart(19)}`,
    );
  }
  return lines;
}

function percentileList(levels) {
  const pct = LEVEL_NAMES.map((name) => `${levels[name].percentile}th`);
  return `${pct[0]}, ${pct[1]} and ${pct[2]}`;
}

function formatFees(summary, host) {
  const { levels, sampleCount, blockCount, slotRange, payingCount, computeUnits } = summary;
  const share = Math.round((100 * payingCount) / sampleCount);

  const lines = ['Priority fee recommendation', '', ...levelTable(levels), ''];
  lines.push(`Per-CU price assumes a ${formatInt(computeUnits)} compute unit limit (change it with --units).`);
  lines.push(
    `Based on ${formatInt(sampleCount)} non-vote transactions in ${blockCount} recent ` +
      `${blockCount === 1 ? 'block' : 'blocks'} (slots ${slotRange.from} to ${slotRange.to}) via ${host}.`,
  );
  lines.push(`${share}% of them paid a priority fee.`);
  lines.push(`low, medium and high are the ${percentileList(levels)} percentile of the priority fee those transactions paid.`);
  if (levels.low.lamports === 0) {
    lines.push('A low fee of 0 means at least half of the sampled transactions paid no priority fee.');
  }

  return lines.join('\n');
}

function formatAccountFees(summary, host, accountCount) {
  const { levels, sampleCount, slotRange, computeUnits } = summary;
  const single = accountCount === 1;

  const lines = [`Priority fee floor for ${accountCount} ${single ? 'account' : 'accounts'}`, '', ...levelTable(levels), ''];
  lines.push(`Lamports per transaction assume a ${formatInt(computeUnits)} compute unit limit (change it with --units).`);
  lines.push(`Based on ${formatInt(sampleCount)} recent slots (${slotRange.from} to ${slotRange.to}) via ${host}.`);
  lines.push(
    `For each slot the RPC reports the fee needed to land a transaction that locks ` +
      `${single ? 'this account' : 'all of these accounts'} as writable.`,
  );
  lines.push(`low, medium and high are the ${percentileList(levels)} percentile across those slots.`);
  lines.push('This is a floor for getting in, not a bid to win: if the account is contested, pay above it.');
  if (levels.low.microLamportsPerUnit === 0) {
    lines.push(
      `A low fee of 0 means at least half of the recent slots needed no priority fee for ${single ? 'this account' : 'these accounts'}.`,
    );
  }

  return lines.join('\n');
}

module.exports = { formatFees, formatAccountFees, formatInt };
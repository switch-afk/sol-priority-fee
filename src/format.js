'use strict';

function formatInt(n) {
  return Number(n).toLocaleString('en-US');
}

function formatFees(summary, host) {
  const { levels, sampleCount, blockCount, slotRange, payingCount, computeUnits } = summary;
  const share = Math.round((100 * payingCount) / sampleCount);
  const names = ['low', 'medium', 'high'];
  const pct = names.map((name) => `${levels[name].percentile}th`);

  const lines = ['Priority fee recommendation', ''];
  lines.push(`  ${'level'.padEnd(8)}${'lamports/tx'.padStart(14)}${'micro-lamports/CU'.padStart(19)}`);
  for (const name of names) {
    const level = levels[name];
    lines.push(
      `  ${name.padEnd(8)}${formatInt(level.lamports).padStart(14)}${formatInt(level.microLamportsPerUnit).padStart(19)}`,
    );
  }

  lines.push('');
  lines.push(`Per-CU price assumes a ${formatInt(computeUnits)} compute unit limit (change it with --units).`);
  lines.push(
    `Based on ${formatInt(sampleCount)} non-vote transactions in ${blockCount} recent ` +
      `${blockCount === 1 ? 'block' : 'blocks'} (slots ${slotRange.from} to ${slotRange.to}) via ${host}.`,
  );
  lines.push(`${share}% of them paid a priority fee.`);
  lines.push(`low, medium and high are the ${pct[0]}, ${pct[1]} and ${pct[2]} percentile of the priority fee those transactions paid.`);
  if (levels.low.lamports === 0) {
    lines.push('A low fee of 0 means at least half of the sampled transactions paid no priority fee.');
  }

  return lines.join('\n');
}

module.exports = { formatFees, formatInt };
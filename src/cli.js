'use strict';

const pkg = require('../package.json');
const { parseArgs } = require('./args');
const { resolveEndpoint, hostLabel, RpcError } = require('./rpc');
const { sampleRecentFees, summarizeFees, DEFAULT_COMPUTE_UNITS } = require('./fees');
const { formatFees } = require('./format');

const HELP = `sol-priority-fee - recommended Solana priority fee from what recent transactions paid

Usage:
  sol-priority-fee [options]

Options:
  --units <n>          Compute unit limit used for the per-CU price (default: ${DEFAULT_COMPUTE_UNITS})
  --account <address>  Only consider fees for transactions touching this account (repeatable)
  --rpc <url>          RPC endpoint (default: SOL_PRIORITY_FEE_RPC, then public mainnet RPC)
  --watch              Keep refreshing the recommendation
  --json               Print machine-readable JSON
  -v, --version        Print version
  -h, --help           Show this help
`;

function defaultIo() {
  return {
    out: (text) => process.stdout.write(text + '\n'),
    err: (text) => process.stderr.write(text + '\n'),
  };
}

async function run(argv, io = defaultIo(), deps = {}) {
  const opts = parseArgs(argv);

  if (opts.errors.length > 0) {
    for (const message of opts.errors) io.err(`error: ${message}`);
    io.err('Run sol-priority-fee --help for usage.');
    return 2;
  }

  if (opts.help) {
    io.out(HELP);
    return 0;
  }

  if (opts.version) {
    io.out(pkg.version);
    return 0;
  }

  const notYet = [];
  if (opts.accounts.length > 0) notYet.push('--account');
  if (opts.watch) notYet.push('--watch');
  if (opts.json) notYet.push('--json');
  if (notYet.length > 0) {
    io.err(`error: ${notYet.join(', ')} not available yet (coming in a later release).`);
    return 2;
  }

  const endpoint = resolveEndpoint(opts.rpc, deps.env || process.env);
  const rpcOptions = { fetchImpl: deps.fetchImpl, sleepImpl: deps.sleepImpl };

  try {
    const sample = await sampleRecentFees(endpoint, { rpcOptions });
    const summary = summarizeFees(sample, { computeUnits: opts.units || DEFAULT_COMPUTE_UNITS });
    if (!summary) {
      io.err('error: no usable transactions found in recent blocks.');
      io.err('Try again in a moment or use a different RPC (--rpc <url>).');
      return 1;
    }
    io.out(formatFees(summary, hostLabel(endpoint)));
    return 0;
  } catch (err) {
    if (err instanceof RpcError) {
      io.err(`error: ${err.message}`);
      if (err.hint) io.err(err.hint);
      return 1;
    }
    throw err;
  }
}

module.exports = { run, HELP };
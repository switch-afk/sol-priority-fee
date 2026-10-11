'use strict';

const pkg = require('../package.json');
const { parseArgs } = require('./args');
const { resolveEndpoint, hostLabel, RpcError } = require('./rpc');
const { isValidAddress } = require('./base58');
const {
  sampleRecentFees,
  fetchAccountFees,
  summarizeFees,
  summarizeAccountFees,
  DEFAULT_COMPUTE_UNITS,
} = require('./fees');
const { formatFees, formatAccountFees } = require('./format');

const MAX_ACCOUNTS = 128;

const HELP = `sol-priority-fee - recommended Solana priority fee from what recent transactions paid

Usage:
  sol-priority-fee [options]

Options:
  --account <address>  Fee floor for landing a transaction that locks this account as
                       writable (repeatable, up to ${MAX_ACCOUNTS})
  --units <n>          Compute unit limit used for the prices (default: ${DEFAULT_COMPUTE_UNITS})
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

function checkAccounts(accounts) {
  const unique = [...new Set(accounts)];
  const errors = [];
  for (const address of unique) {
    if (!isValidAddress(address)) {
      errors.push(`--account is not a valid Solana address: ${address.slice(0, 60)}`);
    }
  }
  if (unique.length > MAX_ACCOUNTS) {
    errors.push(`--account can be used at most ${MAX_ACCOUNTS} times`);
  }
  return { accounts: unique, errors };
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

  const checked = checkAccounts(opts.accounts);
  if (checked.errors.length > 0) {
    for (const message of checked.errors) io.err(`error: ${message}`);
    return 2;
  }

  const notYet = [];
  if (opts.json) notYet.push('--json');
  if (opts.watch) notYet.push('--watch');
  if (notYet.length > 0) {
    io.err(`error: ${notYet.join(', ')} not available yet (coming in a later release).`);
    return 2;
  }

  const endpoint = resolveEndpoint(opts.rpc, deps.env || process.env);
  const rpcOptions = { fetchImpl: deps.fetchImpl, sleepImpl: deps.sleepImpl };
  const units = opts.units || DEFAULT_COMPUTE_UNITS;
  const host = hostLabel(endpoint);

  try {
    if (checked.accounts.length > 0) {
      const samples = await fetchAccountFees(endpoint, checked.accounts, rpcOptions);
      const summary = summarizeAccountFees(samples, { computeUnits: units });
      if (!summary) {
        io.err('error: the RPC returned no recent fee samples for these accounts.');
        io.err('Try again in a moment or use a different RPC (--rpc <url>).');
        return 1;
      }
      io.out(formatAccountFees(summary, host, checked.accounts.length));
      return 0;
    }

    const sample = await sampleRecentFees(endpoint, { rpcOptions });
    const summary = summarizeFees(sample, { computeUnits: units });
    if (!summary) {
      io.err('error: no usable transactions found in recent blocks.');
      io.err('Try again in a moment or use a different RPC (--rpc <url>).');
      return 1;
    }
    io.out(formatFees(summary, host));
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
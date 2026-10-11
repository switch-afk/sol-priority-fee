'use strict';

const pkg = require('../package.json');
const { parseArgs, DEFAULT_INTERVAL, MIN_INTERVAL } = require('./args');
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
const { blocksToJson, accountToJson } = require('./json');
const { watchLoop, wait } = require('./watch');

const MAX_ACCOUNTS = 128;
const NO_DATA_HINT = 'Try again in a moment or use a different RPC (--rpc <url>).';

const HELP = `sol-priority-fee - recommended Solana priority fee from what recent transactions paid

Usage:
  sol-priority-fee [options]

Options:
  --account <address>  Fee floor for landing a transaction that locks this account as
                       writable (repeatable, up to ${MAX_ACCOUNTS})
  --units <n>          Compute unit limit used for the prices (default: ${DEFAULT_COMPUTE_UNITS})
  --watch              Keep refreshing until you press Ctrl+C
  --interval <s>       Seconds between refreshes with --watch (default: ${DEFAULT_INTERVAL}, minimum ${MIN_INTERVAL})
  --json               Print JSON (one object per line with --watch)
  --rpc <url>          RPC endpoint (default: SOL_PRIORITY_FEE_RPC, then public mainnet RPC)
  -v, --version        Print version
  -h, --help           Show this help

Without --account, each refresh reads 3 recent blocks (about 4 RPC calls).
`;

function defaultIo() {
  return {
    out: (text) => process.stdout.write(text + '\n'),
    err: (text) => process.stderr.write(text + '\n'),
    clear: process.stdout.isTTY ? () => process.stdout.write('\x1b[2J\x1b[H') : null,
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

async function collect(ctx) {
  const { endpoint, accounts, units, rpcOptions } = ctx;

  if (accounts.length > 0) {
    const samples = await fetchAccountFees(endpoint, accounts, rpcOptions);
    const summary = summarizeAccountFees(samples, { computeUnits: units });
    if (!summary) {
      throw new RpcError('the RPC returned no recent fee samples for these accounts.', {
        hint: NO_DATA_HINT,
        code: 'no-data',
      });
    }
    return { kind: 'account', summary };
  }

  const sample = await sampleRecentFees(endpoint, { rpcOptions });
  const summary = summarizeFees(sample, { computeUnits: units });
  if (!summary) {
    throw new RpcError('no usable transactions found in recent blocks.', {
      hint: NO_DATA_HINT,
      code: 'no-data',
    });
  }
  return { kind: 'blocks', summary };
}

function render(result, ctx, now) {
  const { host, accounts, json, watch } = ctx;

  if (json) {
    const data =
      result.kind === 'account'
        ? accountToJson(result.summary, { host, now, accounts })
        : blocksToJson(result.summary, { host, now });
    // Pretty for a single run, one compact line per refresh while watching.
    return JSON.stringify(data, null, watch ? undefined : 2);
  }

  return result.kind === 'account'
    ? formatAccountFees(result.summary, host, accounts.length)
    : formatFees(result.summary, host);
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

  const endpoint = resolveEndpoint(opts.rpc, deps.env || process.env);
  const ctx = {
    endpoint,
    host: hostLabel(endpoint),
    accounts: checked.accounts,
    units: opts.units || DEFAULT_COMPUTE_UNITS,
    json: opts.json,
    watch: opts.watch,
    rpcOptions: { fetchImpl: deps.fetchImpl, sleepImpl: deps.sleepImpl },
  };
  const now = deps.now || (() => new Date());

  if (!opts.watch) {
    try {
      const result = await collect(ctx);
      io.out(render(result, ctx, now()));
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

  const intervalSeconds = opts.interval || DEFAULT_INTERVAL;
  const controller = deps.signal ? null : new AbortController();
  const signal = deps.signal || controller.signal;
  const onSigint = controller ? () => controller.abort() : null;
  if (onSigint) process.once('SIGINT', onSigint);

  try {
    return await watchLoop({
      intervalMs: intervalSeconds * 1000,
      signal,
      wait: deps.waitImpl || wait,
      io,
      refresh: async () => {
        const result = await collect(ctx);
        const time = now();
        if (opts.json) {
          io.out(render(result, ctx, time));
          return;
        }
        if (io.clear) io.clear();
        else io.out('');
        io.out(`Updated ${time.toISOString().slice(11, 19)} UTC - refreshing every ${intervalSeconds}s, Ctrl+C to stop`);
        io.out('');
        io.out(render(result, ctx, time));
      },
    });
  } finally {
    if (onSigint) process.removeListener('SIGINT', onSigint);
  }
}

module.exports = { run, HELP };
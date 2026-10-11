'use strict';

const pkg = require('../package.json');
const { parseArgs } = require('./args');

const HELP = `sol-priority-fee - recommended Solana priority fee from recent network data

Usage:
  sol-priority-fee [options]

Options:
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

async function run(argv, io = defaultIo()) {
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

  io.err('Fetching fees is not implemented yet.');
  return 1;
}

module.exports = { run, HELP };
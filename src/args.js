'use strict';

function parseArgs(argv) {
  const opts = {
    help: false,
    version: false,
    json: false,
    watch: false,
    rpc: null,
    accounts: [],
    errors: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--version' || arg === '-v') {
      opts.version = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--watch') {
      opts.watch = true;
    } else if (arg === '--rpc' || arg === '--account') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        opts.errors.push(`${arg} needs a value`);
      } else {
        i++;
        if (arg === '--rpc') opts.rpc = value;
        else opts.accounts.push(value);
      }
    } else {
      opts.errors.push(`unknown option: ${arg}`);
    }
  }

  return opts;
}

module.exports = { parseArgs };
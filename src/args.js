'use strict';

const MAX_UNITS = 1400000;

function parseArgs(argv) {
  const opts = {
    help: false,
    version: false,
    json: false,
    watch: false,
    rpc: null,
    units: null,
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
    } else if (arg === '--rpc' || arg === '--account' || arg === '--units') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        opts.errors.push(`${arg} needs a value`);
      } else {
        i++;
        if (arg === '--rpc') {
          opts.rpc = value;
        } else if (arg === '--account') {
          opts.accounts.push(value);
        } else {
          const units = Number(value);
          if (/^\d+$/.test(value) && units >= 1 && units <= MAX_UNITS) {
            opts.units = units;
          } else {
            opts.errors.push(`--units must be a whole number between 1 and ${MAX_UNITS}`);
          }
        }
      }
    } else {
      opts.errors.push(`unknown option: ${arg}`);
    }
  }

  return opts;
}

module.exports = { parseArgs, MAX_UNITS };
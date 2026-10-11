'use strict';

const MAX_UNITS = 1400000;
const DEFAULT_INTERVAL = 10;
const MIN_INTERVAL = 5;
const MAX_INTERVAL = 3600;

function parseArgs(argv) {
  const opts = {
    help: false,
    version: false,
    json: false,
    watch: false,
    rpc: null,
    units: null,
    interval: null,
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
    } else if (arg === '--rpc' || arg === '--account' || arg === '--units' || arg === '--interval') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        opts.errors.push(`${arg} needs a value`);
      } else {
        i++;
        if (arg === '--rpc') {
          opts.rpc = value;
        } else if (arg === '--account') {
          opts.accounts.push(value);
        } else if (arg === '--units') {
          const units = Number(value);
          if (/^\d+$/.test(value) && units >= 1 && units <= MAX_UNITS) {
            opts.units = units;
          } else {
            opts.errors.push(`--units must be a whole number between 1 and ${MAX_UNITS}`);
          }
        } else {
          const seconds = Number(value);
          if (/^\d+$/.test(value) && seconds >= MIN_INTERVAL && seconds <= MAX_INTERVAL) {
            opts.interval = seconds;
          } else {
            opts.errors.push(
              `--interval must be a whole number of seconds between ${MIN_INTERVAL} and ${MAX_INTERVAL}`,
            );
          }
        }
      }
    } else {
      opts.errors.push(`unknown option: ${arg}`);
    }
  }

  if (opts.interval !== null && !opts.watch) {
    opts.errors.push('--interval only works with --watch');
  }

  return opts;
}

module.exports = { parseArgs, MAX_UNITS, DEFAULT_INTERVAL, MIN_INTERVAL, MAX_INTERVAL };
'use strict';

const { RpcError } = require('./rpc');

// Resolves after `ms`, or as soon as the signal aborts.
function wait(ms, signal) {
  return new Promise((resolve) => {
    if (signal && signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', done);
      resolve();
    }
    if (signal) signal.addEventListener('abort', done, { once: true });
  });
}

// Calls refresh() every intervalMs until the signal aborts.
// RPC failures are reported and retried; too many in a row ends the loop with exit code 1.
async function watchLoop({ refresh, intervalMs, signal, wait: waitFn = wait, io, maxFailures = 5 }) {
  let failures = 0;

  while (!signal.aborted) {
    try {
      await refresh();
      failures = 0;
    } catch (err) {
      if (!(err instanceof RpcError)) throw err;
      failures++;
      io.err(`error: ${err.message}`);
      if (err.hint && failures === 1) io.err(err.hint);
      if (failures >= maxFailures) {
        io.err(`error: giving up after ${maxFailures} failed refreshes in a row.`);
        return 1;
      }
    }

    if (signal.aborted) break;
    await waitFn(intervalMs, signal);
  }

  return 0;
}

module.exports = { watchLoop, wait };
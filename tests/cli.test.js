'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/cli');
const pkg = require('../package.json');

function capture() {
  const lines = { out: [], err: [] };
  return {
    lines,
    io: {
      out: (text) => lines.out.push(text),
      err: (text) => lines.err.push(text),
    },
  };
}

test('--help prints usage and exits 0', async () => {
  const { lines, io } = capture();
  const code = await run(['--help'], io);
  assert.equal(code, 0);
  assert.match(lines.out.join('\n'), /Usage:/);
});

test('--version prints the package version', async () => {
  const { lines, io } = capture();
  const code = await run(['--version'], io);
  assert.equal(code, 0);
  assert.equal(lines.out[0], pkg.version);
});

test('unknown option exits 2 with a hint', async () => {
  const { lines, io } = capture();
  const code = await run(['--nope'], io);
  assert.equal(code, 2);
  assert.match(lines.err.join('\n'), /unknown option: --nope/);
  assert.match(lines.err.join('\n'), /--help/);
});
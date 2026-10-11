'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../src/args');

test('no arguments gives defaults', () => {
  const opts = parseArgs([]);
  assert.equal(opts.help, false);
  assert.equal(opts.json, false);
  assert.equal(opts.watch, false);
  assert.equal(opts.rpc, null);
  assert.deepEqual(opts.accounts, []);
  assert.deepEqual(opts.errors, []);
});

test('parses flags and values', () => {
  const opts = parseArgs(['--json', '--watch', '--rpc', 'https://example.com', '--account', 'A', '--account', 'B']);
  assert.equal(opts.json, true);
  assert.equal(opts.watch, true);
  assert.equal(opts.rpc, 'https://example.com');
  assert.deepEqual(opts.accounts, ['A', 'B']);
  assert.deepEqual(opts.errors, []);
});

test('short flags work', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
});

test('unknown option is reported', () => {
  const opts = parseArgs(['--nope']);
  assert.deepEqual(opts.errors, ['unknown option: --nope']);
});

test('missing value is reported', () => {
  assert.deepEqual(parseArgs(['--rpc']).errors, ['--rpc needs a value']);
  assert.deepEqual(parseArgs(['--account', '--json']).errors, ['--account needs a value']);
});
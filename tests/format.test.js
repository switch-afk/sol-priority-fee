'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeFees } = require('../src/fees');
const { formatFees } = require('../src/format');

test('formatFees shows the three levels, per-CU prices and the source', () => {
  const summary = summarizeFees({
    fees: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
    slots: [1000],
  });
  const text = formatFees(summary, 'rpc.example.com');
  assert.match(text, /Priority fee recommendation/);
  assert.match(text, /low\s+5,000\s+25,000/);
  assert.match(text, /Per-CU price assumes a 200,000 compute unit limit/);
  assert.match(text, /Based on 10 non-vote transactions in 1 recent block \(slots 1000 to 1000\) via rpc\.example\.com\./);
  assert.match(text, /100% of them paid a priority fee\./);
  assert.match(text, /50th, 75th and 90th percentile/);
  assert.doesNotMatch(text, /paid no priority fee/);
});

test('formatFees explains a zero low fee', () => {
  const summary = summarizeFees({ fees: [0, 0, 0, 0], slots: [1000, 999] });
  const text = formatFees(summary, 'rpc.example.com');
  assert.match(text, /in 2 recent blocks/);
  assert.match(text, /A low fee of 0 means/);
});
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeFees, summarizeAccountFees } = require('../src/fees');
const { formatFees, formatAccountFees } = require('../src/format');

function accountSamples(fees) {
  return fees.map((fee, i) => ({ slot: 10 + i, prioritizationFee: fee }));
}

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

test('formatAccountFees describes a single account, the window and labels the result as a floor', () => {
  const summary = summarizeAccountFees(accountSamples([0, 0, 100, 200, 300, 400, 500, 600, 700, 800]));
  const text = formatAccountFees(summary, 'rpc.example.com', 1);
  assert.match(text, /Priority fee floor for 1 account\b/);
  assert.match(text, /low\s+60\s+300/);
  assert.match(text, /Lamports per transaction assume a 200,000 compute unit limit/);
  assert.match(text, /Based on 10 recent slots \(10 to 19, about 4 seconds\) via rpc\.example\.com\./);
  assert.match(text, /locks this account as writable/);
  assert.match(text, /50th, 75th and 90th percentile/);
  assert.match(text, /a floor for getting in, not a bid to win/);
  assert.doesNotMatch(text, /A low fee of 0/);
});

test('formatAccountFees describes several accounts and explains a zero low fee', () => {
  const summary = summarizeAccountFees(accountSamples([0, 0, 0, 0]));
  const text = formatAccountFees(summary, 'rpc.example.com', 3);
  assert.match(text, /Priority fee floor for 3 accounts/);
  assert.match(text, /locks all of these accounts as writable/);
  assert.match(text, /A low fee of 0 means at least half of the recent slots needed no priority fee for these accounts\./);
});
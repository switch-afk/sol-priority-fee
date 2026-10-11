'use strict';

const { rpcCall, resolveEndpoint, hostLabel, RpcError } = require('./rpc');
const { isValidAddress, decodeBase58 } = require('./base58');
const {
  sampleRecentFees,
  extractPriorityFees,
  fetchAccountFees,
  summarizeFees,
  summarizeAccountFees,
  percentile,
  computePriceMicroLamports,
  lamportsForPrice,
} = require('./fees');
const { formatFees, formatAccountFees } = require('./format');

module.exports = {
  rpcCall,
  resolveEndpoint,
  hostLabel,
  RpcError,
  isValidAddress,
  decodeBase58,
  sampleRecentFees,
  extractPriorityFees,
  fetchAccountFees,
  summarizeFees,
  summarizeAccountFees,
  percentile,
  computePriceMicroLamports,
  lamportsForPrice,
  formatFees,
  formatAccountFees,
};
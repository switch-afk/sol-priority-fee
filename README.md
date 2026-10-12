# sol-priority-fee

[![Tests](https://github.com/switch-afk/sol-priority-fee/actions/workflows/test.yml/badge.svg)](https://github.com/switch-afk/sol-priority-fee/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/sol-priority-fee)](https://www.npmjs.com/package/sol-priority-fee)

A zero-dependency Node.js CLI that recommends a Solana priority fee from what recent transactions actually paid, or from the fee floor of the accounts your transaction touches.

```bash
npx sol-priority-fee
```

## Why not just call `getRecentPrioritizationFees`?

When this tool was built, that RPC method, called without accounts, returned a fee of 0 for all 150 of the most recent slots on mainnet. Percentiles of zeros tell you nothing, so the default mode reads what non-vote transactions really paid in recent blocks instead. The per-account version of the same RPC method is still useful, and it is available with `--account`.

## Usage

```bash
# Recommendation from what transactions paid in the last 3 blocks
sol-priority-fee

# Prices for a 60,000 compute unit limit
sol-priority-fee --units 60000

# Fee floor for landing a transaction that locks these accounts as writable
sol-priority-fee --account <address> [--account <address> ...]

# Keep refreshing every 10 seconds (Ctrl+C to stop)
sol-priority-fee --watch

# Machine-readable output
sol-priority-fee --json
sol-priority-fee --watch --json --interval 5
```

Requires Node.js 18 or newer (CI runs on 20 and 22). No dependencies.

## Options

| Option | What it does |
| --- | --- |
| `--account <address>` | Fee floor for landing a transaction that locks this account as writable. Repeatable, up to 128. Addresses are validated as 32-byte base58 before any RPC call. |
| `--units <n>` | Compute unit limit used to convert between lamports and micro-lamports per compute unit. Default 200000, maximum 1400000. |
| `--watch` | Keep refreshing until you press Ctrl+C. A failed refresh is reported and retried; after 5 failures in a row it stops with exit code 1. |
| `--interval <s>` | Seconds to pause between refreshes with `--watch`. Default 10, from 5 to 3600. The time to fetch the data comes on top of this. |
| `--json` | Print JSON: one pretty object for a single run, one compact line per refresh with `--watch`. |
| `--rpc <url>` | RPC endpoint. Overrides the environment variable. |
| `-v`, `--version` | Print the version. |
| `-h`, `--help` | Show help. |

## RPC endpoint

The endpoint comes from `--rpc`, then the `SOL_PRIORITY_FEE_RPC` environment variable, then the public mainnet RPC, which rate-limits heavily. Use your own endpoint for anything beyond a quick try.

```bash
export SOL_PRIORITY_FEE_RPC="https://your-rpc-provider.example/your-key"
sol-priority-fee
```

Only the hostname of the endpoint is ever printed, because RPC URLs often contain API keys.

Cost per refresh:
- Default mode: `getSlot` plus `getBlock` for 3 recent blocks, about 4 calls. Blocks are large, so on a free tier use a longer `--interval`.
- `--account` mode: 1 call (`getRecentPrioritizationFees`).

## Output

Default mode reads the priority fee each non-vote transaction paid in the 3 most recent blocks. `low`, `medium` and `high` are the 50th, 75th and 90th percentile.

```
Priority fee recommendation

  level      lamports/tx  micro-lamports/CU
  low                  8                 40
  medium             607              3,035
  high             5,193             25,965

Per-CU price assumes a 200,000 compute unit limit (change it with --units).
Based on 1,052 non-vote transactions in 3 recent blocks (slots 455731533 to 455731535) via mainnet.helius-rpc.com.
56% of them paid a priority fee.
low, medium and high are the 50th, 75th and 90th percentile of the priority fee those transactions paid.
```

`--account` mode shows, per slot, the fee the RPC reports for landing a transaction that locks the account as writable, over the last 150 slots (about 60 seconds). This is a quiet account, so most of it is 0:

```
Priority fee floor for 1 account

  level      lamports/tx  micro-lamports/CU
  low                  0                  0
  medium               0                  0
  high                 1                  4

Lamports per transaction assume a 200,000 compute unit limit (change it with --units).
Based on 150 recent slots (455736543 to 455736692, about 60 seconds) via mainnet.helius-rpc.com.
For each slot the RPC reports the fee needed to land a transaction that locks this account as writable.
low, medium and high are the 50th, 75th and 90th percentile across those slots.
This is a floor for getting in, not a bid to win: if the account is contested, pay above it.
A low fee of 0 means at least half of the recent slots needed no priority fee for this account.
```

JSON (default mode):

```json
{
  "mode": "recent-transactions",
  "time": "2026-10-11T17:39:35.566Z",
  "rpc": "mainnet.helius-rpc.com",
  "computeUnits": 200000,
  "slotRange": { "from": 455736632, "to": 455736634 },
  "blockCount": 3,
  "sampleCount": 1498,
  "payingCount": 1237,
  "levels": {
    "low": { "percentile": 50, "lamports": 809, "microLamportsPerUnit": 4045 },
    "medium": { "percentile": 75, "lamports": 4770, "microLamportsPerUnit": 23850 },
    "high": { "percentile": 90, "lamports": 10350, "microLamportsPerUnit": 51750 }
  }
}
```

With `--account` the object has `"mode": "account-floor"`, an `accounts` array and a `zeroCount` instead of the block fields.

## Using the numbers

The value to set on a transaction is the micro-lamports per compute unit price, together with a compute unit limit. Use the same `--units` as the limit you set, so the lamports figure matches what you will pay.

```js
const { ComputeBudgetProgram } = require('@solana/web3.js');

const instructions = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 3035 }),
  // ...your instructions
];
```

Priority fee in lamports is `price in micro-lamports per CU * compute unit limit / 1,000,000`.

## Programmatic use

```js
const { resolveEndpoint, sampleRecentFees, summarizeFees } = require('sol-priority-fee');

(async () => {
  const endpoint = resolveEndpoint(null);
  const sample = await sampleRecentFees(endpoint, {});
  const summary = summarizeFees(sample, { computeUnits: 200000 });
  console.log(summary.levels.medium.microLamportsPerUnit);
})();
```

## Honest limits

- A recommendation is a statistical guess from a small, recent sample, not a guarantee of inclusion. Fees can spike faster than any sample shows.
- Default mode samples 3 blocks. It excludes vote transactions and counts only the priority fee: the total fee minus 5,000 lamports per signature. Tips sent as separate transfers (for example to a bundle service) are not counted.
- The lamports-per-transaction figure in default mode is what transactions paid, whatever their compute unit limit was. The micro-lamports-per-CU figure converts it using `--units`, so it is only exact for transactions with that limit.
- `--account` mode covers about 60 seconds. Accounts go quiet quickly, so 0 is common for anything that is not contested right now.
- The per-account figure is a floor for getting in. If many transactions compete for the same account, pay above it.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success, or stopped with Ctrl+C in watch mode |
| 1 | RPC error, no usable data, or watch mode gave up after 5 failed refreshes |
| 2 | Invalid options or addresses |

## Development

```bash
npm test
```

Tests use Node's built-in test runner and a mock RPC helper, so they run offline. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
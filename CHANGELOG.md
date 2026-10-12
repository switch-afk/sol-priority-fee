# Changelog

## 0.1.0 - 2026-10-11

First release.

### Added
- Recommendation from the priority fees paid by non-vote transactions in the 3 most recent blocks: low, medium and high (50th, 75th and 90th percentile), as lamports per transaction and micro-lamports per compute unit.
- `--units` to choose the compute unit limit used for the prices.
- `--account` (repeatable, up to 128): per-account fee floor from `getRecentPrioritizationFees`, with base58 address validation.
- `--watch` and `--interval` to keep refreshing; failed refreshes are retried and watch mode stops after 5 in a row.
- `--json` output, pretty for a single run and one compact line per refresh with `--watch`.
- `--rpc` and the `SOL_PRIORITY_FEE_RPC` environment variable; only the RPC hostname is ever printed.
- Retry with backoff on HTTP 429 and plain-English RPC errors.
- Programmatic API exported from the package entry point.
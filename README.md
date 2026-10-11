# sol-priority-fee

A zero-dependency Node.js CLI that recommends a Solana priority fee based on recent network data.

> Status: early development. The scaffold is in place; fee fetching is coming in the next releases.

## Planned usage

```bash
npx sol-priority-fee
npx sol-priority-fee --account <address>
npx sol-priority-fee --watch
npx sol-priority-fee --json
```

## Requirements

- Node.js 18 or newer

## RPC endpoint

The public mainnet RPC rate-limits heavily. Set your own endpoint with the `SOL_PRIORITY_FEE_RPC` environment variable or pass `--rpc <url>`.

## Honest limits

A recommendation is a statistical guess from recent blocks, not a guarantee of inclusion. Fees can spike faster than any sample can show.

## Development

```bash
npm test
```

## License

MIT
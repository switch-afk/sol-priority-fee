# Contributing

Thanks for helping. This project stays small on purpose: zero runtime dependencies, plain CommonJS, Node.js 18 or newer.

## Setup

```bash
git clone https://github.com/switch-afk/sol-priority-fee.git
cd sol-priority-fee
npm test
```

There is nothing to install. Tests use Node's built-in test runner.

## Making a change

1. Branch from `main`.
2. Add or update tests with your change. Tests must run offline: use the mock RPC in `tests/helpers/mock-rpc.js`, never a real endpoint.
3. Run `npm test` and make sure it passes.
4. Open a pull request that explains what changed and why.

## Guidelines

- No runtime dependencies.
- Never print a full RPC URL: it can contain an API key. Use `hostLabel` from `src/rpc.js`.
- Keep output plain and honest about what a number means. If a figure is a floor or an estimate, say so.
- Errors should be plain English with a hint on what to do next.

## Reporting a problem

Open an issue with the command you ran, the output, and your Node.js version. Remove any API keys from what you paste.
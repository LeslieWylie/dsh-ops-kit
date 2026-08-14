# Contributing

## Local checks

Use Node.js 22 or newer and run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm pack --dry-run
```

## Adding a capability

Prefer a portable skill or read-only tool with an explicit boundary. Document its inputs, outputs, side effects, failure conditions, and verification path. Keep filesystem access bounded by configured roots and do not add implicit network or repository writes.

## Data hygiene

Do not commit credentials, private raw data, run archives, model transcripts, machine-local absolute paths, or copied internal repositories. Use synthetic fixtures in tests. The package must remain useful without access to any internal source project.

## Pull requests

Explain the behavior change, affected files, validation commands, and known limitations. Keep authorship and design provenance accurate.

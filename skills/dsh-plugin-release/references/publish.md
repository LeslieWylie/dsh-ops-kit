# Publish checklist

- repository has an explicit owner and license;
- README includes install, supported DSH version, configuration, limits, and examples;
- `pnpm install --offline --ignore-scripts`, build, typecheck, and tests pass;
- public tree contains no credentials, run outputs, machine-local absolute paths, or raw model logs;
- live DSH profile loads the bundle and remains healthy after restart;
- GitHub repository is tagged with `dsh-plugin` only after the above checks;
- branch/commit/PR and rollback path are recorded.

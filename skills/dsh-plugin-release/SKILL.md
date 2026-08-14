---
name: dsh-plugin-release
description: Turn local DSH extensions into portable, documented, verified, and honestly attributed public bundles.
---

# DSH plugin release

Use this skill when packaging a DSH/Cordis plugin or publishing it to the `dsh-plugin` ecosystem.

## Package contract

Provide `package.json`, ESM exports, TypeScript declarations, `dsh.bundle.patch` when the bundle needs profile rows, README in the audience's language, tests, and a license. Keep runtime dependencies as peers where the host owns the version.

## Verification order

1. Inspect `git status` and isolate intended paths.
2. Scan for secrets, absolute machine paths, run archives, and private data.
3. Run offline install, build, typecheck, and tests.
4. Install into a disposable or named DSH profile.
5. Restart the live service and verify HTTP status, process state, effective profile, and one real tool call.
6. Record known limitations and rollback before publishing.

## Public attribution

State what is original, what is adapted, and what remains an external dependency. Do not claim official authorship or upstream acceptance. Adding the `dsh-plugin` topic makes a repository discoverable; it does not transfer code into the official repository.

## Rollback

Disable the bundle row or remove it from `dsh.profile.bundles`, restart DSH, and preserve the failing logs. Never delete a user's source or overwrite an unrelated profile to recover.

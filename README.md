# dsh-ops-kit

`dsh-ops-kit` is a reusable DeepSeek Harness bundle for evidence-driven memory, orchestration, benchmark operations, repository audits, and plugin release workflows. It packages a substantial set of portable skills and read-only tools:

- Git-first memory: bounded local retrieval, source provenance, validation, and promotion evidence.
- RLVR orchestration: scope → baseline → adaptive work → coverage review → artifact handoff.
- OctoLoop orchestration: leader-only dispatch, shared-worktree coordination, runtime ownership, and cleanup evidence.
- Benchmark evidence: manifests, prechecks, artifact inventories, and secret hygiene.
- DSH plugin release: package contracts, offline installation, live profile probes, and rollback.

The bundle is intentionally substantial but conservative: it does not silently create issues, invoke remote APIs, run a benchmark, mutate a repository, or read credentials. It gives the agent plans, checks, and evidence vocabulary so those actions remain explicit and reviewable.

## Install

```bash
pnpm add https://github.com/LeslieWylie/dsh-ops-kit.git
```

Add the package to a DSH profile:

```json
{
  "dependencies": {
    "@dsh-community/dsh-ops-kit": "^0.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@dsh-community/dsh-ops-kit"]
    }
  }
}
```

The bundle registers these tools:

| Tool | What it does | Side effects |
| --- | --- | --- |
| `dsh_ops_capability_catalog` | Lists the included capability packs | None |
| `dsh_ops_workflow_plan` | Produces a mode-specific evidence plan | None |
| `dsh_ops_skill_read` | Reads a packaged full skill | None |
| `dsh_ops_memory_search` | Searches bounded local Markdown/code roots | Read-only |
| `dsh_ops_repository_audit` | Audits Git state and release blockers | Read-only |
| `dsh_ops_release_checklist` | Produces a complete release checklist | None |

## Configure local roots

When using `dsh_ops_memory_search` or `dsh_ops_repository_audit`, configure roots to the directories the profile may inspect. Keep the root narrow and never point it at a credential directory.

```yaml
# example overlay; adapt to the profile's configuration format
- id: dsh-ops-kit
  config:
    roots:
      - /workspace/project
      - /workspace/memory
    maxFiles: 120
    maxBytesPerFile: 160000
```

If no roots are configured, the tools default to the DSH process working directory. Credential-like paths and common run/secret directories are rejected or skipped.

## Design provenance

This package is a new, standalone integration layer distilled from general engineering practices. Internal source repositories are intentionally not copied or published; no credentials, raw private data, generated run outputs, or machine-specific configuration belong here.

## Verification

```bash
pnpm install --offline --ignore-scripts
pnpm build
pnpm typecheck
pnpm test
```

After installing into a live profile, verify that the DSH endpoint returns HTTP 200, the profile stays running after restart, the packaged skills are listed, and `dsh_ops_capability_catalog` returns the five capability packs.

## License

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before contributing.

MIT.

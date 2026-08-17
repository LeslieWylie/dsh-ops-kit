# dsh-ops-kit

[English](#) | [中文](README.zh.md)

**Five read-only skills that make an agent show its evidence — before it claims memory, a finished plan, a clean benchmark, or a safe release.**

The bundle also includes a runtime doctor for the official PTY prompt handshake, because minimal-mode bash can otherwise look hung when the terminal and persistent-bash plugins use different completion prompts.

## Why this exists

Agents are persuasive even when they are wrong. This bundle is built around one rule: before an agent says "I remember this," "the plan is ready," "the benchmark passed," or "the release is safe," it should be able to point at evidence for the claim instead of just asserting it. Five focused skill packs share that discipline — bounded memory search, evidence-based orchestration planning, agent-loop coordination rules, benchmark-result gating, and plugin release hygiene — instead of shipping the same idea as five separate packages that each need their own install and their own place in a plugin index.

Everything here is conservative by default: nothing silently creates issues, calls a remote API, starts a benchmark, mutates a repository, or reads credentials. The bundle gives an agent plans, checks, and evidence vocabulary; anything with a side effect stays an explicit, reviewable action taken outside the bundle.

## Install

The package is not on the npm registry yet, so install it straight from GitHub. Add it to a DSH profile's `package.json`:

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@dsh-community/dsh-ops-kit": "github:LeslieWylie/dsh-ops-kit"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@dsh-community/dsh-ops-kit"]
    }
  }
}
```

Then reinstall dependencies for that profile and restart it. If your `dsh` CLI build supports adding a plugin by spec directly, this is the equivalent one-liner:

```bash
dsh plugin --profile <profile> add github:LeslieWylie/dsh-ops-kit
```

## What's inside

| Capability pack | Tool | What it does | Side effects |
| --- | --- | --- | --- |
| Capability index | `dsh_ops_capability_catalog` | Lists the included capability packs | None |
| Evidence-based orchestration | `dsh_ops_workflow_plan` | Produces a scope → baseline → work → coverage-review → handoff plan for research, multi-agent, benchmark, or release work | None |
| Skill reference | `dsh_ops_skill_read` | Reads a packaged full skill definition | None |
| Git-first memory | `dsh_ops_memory_search` | Searches bounded local Markdown/code roots for prior context, with source provenance | Read-only |
| Repository audit | `dsh_ops_repository_audit` | Audits Git cleanliness, untracked files, and credential-path hygiene | Read-only |
| Release hygiene | `dsh_ops_release_checklist` | Produces a complete DSH plugin release checklist | None |
| Release verification | `dsh_ops_plugin_doctor` | Checks a plugin repository against the checklist instead of restating it: `dsh.bundle` + `cordis.patch.yml` installability, patch row vs package name, `private`/`files`/`exports` publishability, `@deepseek-ai/*` kept as peers, and boot suites that print `SKIPPED` then `exit 0` | Read-only |
| Runtime health | `dsh_ops_runtime_doctor` | Checks official terminal/persistent-bash prompt compatibility | Read-only |

`dsh_ops_release_checklist` says what a release needs; `dsh_ops_plugin_doctor` measures whether it happened. The split is deliberate — a checklist that no one verifies is how a boot suite ended up printing `SKIPPED` and exiting `0`, turning CI green while the integration check never ran, and how a plugin stayed at `"private": true` and could never be published at all.

Agent-loop orchestration rules (leader-only dispatch, shared-worktree coordination, runtime ownership, cleanup evidence) and benchmark-evidence gating (manifests, prechecks, artifact inventory, result-integrity checks) ride along inside the workflow-plan and release-checklist skills rather than as separate tools.

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

This package is a standalone integration layer distilled from general engineering practice, not a copy of any internal source repository. No credentials, raw private data, generated run outputs, or machine-specific configuration belong here.

## Verification

```bash
pnpm install --offline --ignore-scripts
pnpm build
pnpm typecheck
pnpm test
```

The package also ships a guarded `dsh-terminal-hotfix` command. It only patches the known official rc.6 compiled entry after an exact-layout check, creates a timestamped backup, and verifies the prompt handshake afterwards:

```bash
dsh-terminal-hotfix --check
dsh-terminal-hotfix --apply
```

Restart DSH after applying it. The command is intentionally not run by the plugin loader and never silently edits dependencies.

After installing into a live profile, verify that the DSH endpoint returns HTTP 200, the profile stays running after restart, the packaged skills are listed, `dsh_ops_capability_catalog` returns all capability packs, and `dsh_ops_runtime_doctor` is healthy. If it reports `terminal-prompt-mismatch`, use `dsh-terminal-hotfix --check` before applying a reversible repair; the doctor itself never edits `node_modules`.

## License

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before contributing.

MIT.

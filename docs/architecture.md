# Architecture

## Runtime shape

```text
DSH profile
  └── dsh-ops-kit bundle
       ├── capability catalog
       ├── evidence-first workflow planner
       ├── packaged skills
       ├── bounded local memory search
       ├── repository hygiene audit
       └── release checklist generator
```

The bundle is deliberately an integration layer. A long-running research agent, scheduled routine automation, a separate memory system, and an authenticated agent-fleet CLI remain separate capabilities. This package teaches the agent how to coordinate them and provides read-only inspection primitives; it does not replace their runtimes.

## Evidence contract

Every plan ends with:

1. objective and non-goals;
2. baseline and effective configuration;
3. changed paths and command output;
4. focused validation and live reconnect/use probe;
5. known risk, rollback, and handoff artifact.

This prevents a green unit test from being reported as a live service proof, and prevents a status label from being reported as an effective runtime configuration.

## Portability contract

The public package contains only source, declarations, skills, documentation, and build metadata. It excludes machine-specific paths, credentials, run archives, model responses, and private repository contents. Local roots are explicit configuration, bounded at runtime, and read-only.

## Why no automatic remote-fleet writes

Issue creation, assignment, rerun, mention, and cleanup against a remote agent-fleet system are side effects. They belong to an authenticated CLI/daemon workflow and require a concrete issue/workspace scope. The plugin can produce a correct plan and audit evidence, while the existing fleet skill/CLI performs an explicitly requested write.

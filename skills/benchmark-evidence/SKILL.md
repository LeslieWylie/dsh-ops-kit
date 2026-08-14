---
name: benchmark-evidence
description: Produce reproducible benchmark manifests, prechecks, artifact inventories, and safe failure classification.
---

# Benchmark evidence

Treat a benchmark run as a self-contained evidence directory. Freeze task id, model profile, source commit, image/runtime identity, start/end time, and runner version before execution.

## Required artifacts

- `manifest.json`: what ran and how it exited.
- `precheck.json`: input/host/artifact/secret hygiene checks.
- `logs/`: prompt assembly, runner, tool/agent audit, and stderr.
- `workspace/artifacts/report.md`: human entry point.
- `workspace/artifacts/result.json`: terminal state and key output paths.
- `cleanup-report.json`: remote/local object cleanup and retained objects.

## Classification

Separate model failure, task failure, infrastructure blocker, timeout, and cleanup failure. A missing baseline repository, wrong runtime, or unusable secret is not a model score. A passing precheck is not proof that the model succeeded.

## Secret hygiene

Credentials are local files or injected environment values only. Never put them in task briefs, images, run manifests, logs, prompts, artifacts, or public packages. Scan before commit and before upload.

---
name: fleet-orchestration
description: Coordinate a fleet of agents with leader-only dispatch, shared-worktree discipline, runtime ownership, and cleanup evidence.
---

# Fleet orchestration

Use this skill when a task uses multi-agent squads, issues, custom runtimes, or benchmark sandbox runs.

## Topology

- The top-level runner prepares environment and baseline only.
- The leader is the sole remote dispatcher and owns the task graph.
- Members receive narrow issues, edit the shared workspace, and hand off commit SHA, changed paths, checks, and risk.
- The auditor reads first-party run messages and local audit artifacts; Git author names are not agent attribution.

## Shared-worktree rule

Members share one worktree and one index unless they explicitly create their own Git worktree. Never use `reset`, `checkout`, or broad cleanup in a member task without coordinating with the leader. Uncommitted changes can be overwritten by another member.

## Runtime rule

Select the runtime by the current run's ownership fingerprint, not by the first matching name. Record runtime id, model, workspace, and slot mapping. A missing or mismatched runtime is an infrastructure blocker, not a model failure.

## Dispatch and recovery

Use stages for ordered work. Retry the same failed subtask at most once; then narrow, reclaim, or converge as `PARTIAL`/`BLOCKED`. Do not let top-level and leader both dispatch the same work.

## Cleanup

Keep the local run ledger until remote objects are verified clean. Cleanup must be idempotent and record attempted, skipped, failed, and retained objects. Never sweep a runtime without an ownership fingerprint.

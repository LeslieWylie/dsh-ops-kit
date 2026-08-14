# Source mapping

| Packaged capability | Local design source | What was extracted |
| --- | --- | --- |
| `rlvr-memory` | Internal Git-backed memory practices | Git-first layers, source provenance, bounded retrieval, read-back validation |
| `rlvr-orchestration` | Internal research and collaboration practices | adaptive research, panel roles, coverage and review contracts |
| `octoloop-orchestration` | Internal benchmark collaboration practices | leader-only dispatch, shared workspace, runtime targeting, cleanup evidence |
| `benchmark-evidence` | General benchmark run/precheck/audit conventions | manifests, logs, artifacts, secret hygiene, failure classification |
| `dsh-plugin-release` | DSH package and profile work in this workspace | bundle contract, offline install, live profile verification, topic release |

The mapping is intentional rather than a blind repository copy. Internal source repositories may contain untracked work, private integrations, credentials, or generated artifacts; those are deliberately not included here.

---
name: rlvr-orchestration
description: Run evidence-driven RLVR research and review loops with explicit roles, coverage, uncertainty, and artifacts.
---

# RLVR evidence orchestration

Use this skill for complex research, benchmark design, model/gateway investigations, or multi-agent review.

## Roles

- **Planner** defines the answer space, purpose, dimensions, acceptance criteria, and blind spots.
- **Researchers** answer independent questions and preserve source URLs, dates, confidence, and gaps.
- **Synthesizer** compresses evidence for the decision while retaining uncertainty and contradictions.
- **Reviewer** performs citation spot checks, coverage audit, and over-confidence detection.

## Adaptive loop

The first round covers all planned dimensions. Later rounds are created only for high-priority gaps or unverified planner assumptions. Stop when marginal information gain is negligible or the declared round budget is reached. Do not turn a fixed fan-out into a fake adaptive loop by inventing empty follow-up rounds.

## Acceptance evidence

Every claim in a final report should be traceable to a source or labeled as inference. The handoff includes a coverage matrix, unresolved contradictions, stale-data risk, and the smallest next research action.

## Failure policy

One failed child may be retried once with a narrower scope. Repeated identical failure becomes `PARTIAL` or `BLOCKED` with the missing dependency and the evidence already collected.

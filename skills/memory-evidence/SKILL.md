---
name: memory-evidence
description: Use Git-first project memory with provenance, bounded retrieval, validation, and explicit knowledge boundaries.
---

# Git-first project memory

Use this skill when the task depends on prior project decisions, memory layers, retrieval quality, or durable research facts.

## Operating loop

1. Identify the repository/memory root and read its `AGENTS.md`, catalog, and index.
2. Search narrow terms first; prefer exact paths and source-backed snippets over a broad dump.
3. Separate `confirmed`, `inferred`, `uncertain`, and `missing` facts.
4. Validate the affected layer: file existence, frontmatter/schema, index population, and read-back of one known item.
5. Never promote a memory entry merely because a command exited zero; require content and provenance evidence.
6. Keep credentials, raw tokens, private keys, and bulky logs out of memory.

## Output contract

Return the query, roots searched, files hit, evidence snippets with line numbers, confidence, contradictions, and the next validation action. If no source-backed hit exists, say so explicitly.

## Boundaries

Memory retrieval is read-only by default. Promotion, deletion, publishing, or vendor adapter changes require explicit user authorization and a before/after validation plan.

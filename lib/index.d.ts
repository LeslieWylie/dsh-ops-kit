/**
 * dsh-ops-kit — reusable evidence-driven operating practices for DSH.
 *
 * This is an actual DSH bundle, not a prompt-only skill pack. It registers
 * bounded, read-only tools that make the operating model visible to the agent:
 * capability discovery, evidence-first planning, packaged skill reading,
 * Git-backed memory search, repository hygiene audits, and release checklists.
 *
 * The bundle intentionally does not silently create issues, call remote Octo
 * APIs, run benchmarks, mutate repositories, or read credentials. Those are
 * separate explicit actions handled by the user's existing tools and CLIs.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-ops-kit";
export declare const inject: string[];
export interface Config {
    /** Optional roots used by dsh_ops_memory_search and dsh_ops_repository_audit. */
    roots?: string[];
    /** Maximum files considered by a bounded local search. */
    maxFiles?: number;
    /** Maximum bytes read from one local text file. */
    maxBytesPerFile?: number;
}
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map
/**
 * dsh-ops-kit — reusable evidence-driven operating practices for DSH.
 *
 * This is an actual DSH bundle, not a prompt-only skill pack. It registers
 * bounded, read-only tools that make the operating model visible to the agent:
 * capability discovery, evidence-first planning, packaged skill reading,
 * Git-backed memory search, repository hygiene audits, and release checklists.
 *
 * The bundle intentionally does not silently create issues, call remote
 * fleet-system APIs, run benchmarks, mutate repositories, or read credentials. Those are
 * separate explicit actions handled by the user's existing tools and CLIs.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, readdir, stat } from 'node:fs/promises'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

const execFileAsync = promisify(execFile)

export const name = 'dsh-ops-kit'
export const inject = ['tools', 'skills']

export interface Config {
  /** Optional roots used by dsh_ops_memory_search and dsh_ops_repository_audit. */
  roots?: string[]
  /** Maximum files considered by a bounded local search. */
  maxFiles?: number
  /** Maximum bytes read from one local text file. */
  maxBytesPerFile?: number
}

type JsonObject = Record<string, unknown>

function asJson(value: unknown): JsonValue {
  return value as JsonValue
}

const CATALOG = [
  {
    id: 'memory-evidence',
    title: 'Git-first project memory',
    purpose: '用可追溯的 Markdown 记忆、索引、校验和分层晋升支撑长期工作。',
    capabilities: ['source-backed retrieval', 'memory validation', 'knowledge boundaries', 'promotion evidence'],
  },
  {
    id: 'research-orchestration',
    title: 'Evidence-driven research orchestration',
    purpose: '把研究、评测、审查、综合拆成可复核阶段，区分事实、推断和缺口。',
    capabilities: ['adaptive research loop', 'coverage audit', 'review gates', 'artifact contracts'],
  },
  {
    id: 'fleet-orchestration',
    title: 'Fleet collaboration',
    purpose: '把 leader、成员、Issue、runtime、共享工作树和清理台账组成可审计编排。',
    capabilities: ['leader-only dispatch', 'shared-worktree handoff', 'runtime targeting', 'cleanup evidence'],
  },
  {
    id: 'benchmark-evidence',
    title: 'Benchmark evidence',
    purpose: '建立运行清单、预检、日志、结果和清理报告之间的证据链。',
    capabilities: ['run manifest', 'precheck', 'artifact inventory', 'secret hygiene'],
  },
  {
    id: 'dsh-plugin-release',
    title: 'DSH plugin release',
    purpose: '将本地能力抽取成可安装、可验证、可公开维护的 DSH bundle。',
    capabilities: ['package contract', 'profile integration', 'offline checks', 'GitHub topic release'],
  },
] as const

const MODES = ['research-loop', 'memory-evidence', 'fleet-benchmark', 'plugin-release', 'incident-review'] as const
type Mode = typeof MODES[number]

const SKILL_FILES: Record<string, string> = {
  'memory-evidence': 'skills/memory-evidence/SKILL.md',
  'research-orchestration': 'skills/research-orchestration/SKILL.md',
  'fleet-orchestration': 'skills/fleet-orchestration/SKILL.md',
  'benchmark-evidence': 'skills/benchmark-evidence/SKILL.md',
  'dsh-plugin-release': 'skills/dsh-plugin-release/SKILL.md',
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EMBEDDED_SKILLS: readonly SkillRegistration[] = Object.entries(SKILL_FILES).map(([skill, path]) => ({
  name: skill,
  description: `dsh-ops-kit 的 ${skill} 能力：证据驱动、可审计、可回滚。`,
  whenToUse: `当任务涉及 ${skill} 的主题时先加载此 skill。`,
  source: 'dsh-ops-kit',
  path: join(PACKAGE_ROOT, path),
  content: readFileSync(join(PACKAGE_ROOT, path), 'utf8'),
  invocation: { modelInvocable: true, userInvocable: true },
}))

const EXCLUDED_DIRS = new Set([
  '.git', '.mimir', '.remember', '.venv', 'node_modules', 'output', 'runs',
  'secrets', 'tmp', 'dist', 'build', '__pycache__',
])
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.yaml', '.yml', '.json', '.jsonl', '.toml', '.ts', '.tsx', '.js', '.mjs', '.sh', '.py'])
const SECRET_PARTS = ['.env', 'secret', 'token', 'credential', 'password', 'api_key', 'private_key', '.pem', '.key']

/** Ceiling on the JSON a single search returns, so one hot keyword cannot flood a context window. */
const RESPONSE_BUDGET_BYTES = 12_000

function intOption(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer in ${min}..${max}`)
  return n
}

function cleanText(value: unknown, max = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function safePath(pathValue: string): boolean {
  const lower = pathValue.toLowerCase()
  return !SECRET_PARTS.some(part => lower.includes(part))
}

function configuredRoots(config: Config): string[] {
  const roots = config.roots?.filter(Boolean).map(path => canonical(path))
  return roots && roots.length > 0 ? roots : [canonical(process.cwd())]
}

/**
 * Resolve a path *and* follow symlinks, falling back to a plain resolve when
 * the path does not exist yet.
 *
 * `resolve()` alone is not enough. On macOS `/tmp` is a symlink to
 * `/private/tmp`, and Node's `process.cwd()` reports the resolved form. So a
 * default root taken from `cwd` came back as `/private/tmp/x` while the user's
 * own `/tmp/x` argument stayed `/tmp/x`, and `within()` rejected a directory
 * that was in fact the root itself. Any symlinked root or home directory hits
 * the same edge, not just `/tmp`.
 */
function canonical(pathValue: string): string {
  const resolved = resolve(pathValue)
  try { return realpathSync(resolved) } catch { return resolved }
}

function within(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  // `rel === ''` means candidate *is* root. Otherwise it must not climb out
  // (`..` or `../…`) and must not be absolute, which is what `relative()`
  // returns when the two paths share no base (different drives on Windows).
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

function assertAllowedPath(input: string, roots: string[]): string {
  const candidate = canonical(input)
  if (!safePath(candidate)) throw new Error('refusing to inspect a credential-like path')
  if (!roots.some(root => within(root, candidate))) {
    throw new Error(`path is outside configured roots: ${candidate}`)
  }
  return candidate
}

async function walkTextFiles(root: string, maxFiles: number, maxDepth = 6): Promise<string[]> {
  const result: string[] = []
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || result.length >= maxFiles) return
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (result.length >= maxFiles) return
      if (entry.name.startsWith('.') && entry.name !== '.agents') continue
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) await visit(join(dir, entry.name), depth + 1)
      } else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        result.push(join(dir, entry.name))
      }
    }
  }
  await visit(root, 0)
  return result
}

function planFor(mode: Mode, objective: string): JsonObject {
  const common = [
    { id: 'scope', title: '定义目标与边界', action: '写清问题、非目标、允许的副作用和验收条件。', evidence: ['objective', 'scope', 'non_goals'] },
    { id: 'baseline', title: '读取基线', action: '检查当前分支、配置、运行状态和已存在的变更。', evidence: ['git status', 'effective config', 'runtime probe'] },
    { id: 'execute', title: '最小可逆执行', action: '按依赖顺序执行，保留中间产物，不把推断当成事实。', evidence: ['command log', 'changed paths', 'result'] },
    { id: 'verify', title: '闭环验证', action: '运行与风险匹配的 focused check，并做真实连接/使用探针。', evidence: ['test', 'live probe', 'known limitations'] },
    { id: 'handoff', title: '交付与复盘', action: '输出可复用结论、提交边界、回滚方式和下一步。', evidence: ['commit', 'artifact manifest', 'rollback'] },
  ]
  const overlays: Record<Mode, JsonObject> = {
    'research-loop': { extra: ['coverage matrix', 'source provenance', 'adversarial review'], roles: ['planner', 'researcher', 'synthesizer', 'reviewer'] },
    'memory-evidence': { extra: ['layer population', 'index validation', 'read-back probe'], roles: ['collector', 'curator', 'validator'] },
    'fleet-benchmark': { extra: ['leader-only dispatch', 'shared-worktree coordination', 'runtime ownership', 'cleanup sweep'], roles: ['top-level', 'leader', 'members', 'auditor'] },
    'plugin-release': { extra: ['package contract', 'secret scan', 'offline install', 'GitHub topic'], roles: ['maintainer', 'validator', 'publisher'] },
    'incident-review': { extra: ['live process', 'effective overrides', 'historical vs current evidence'], roles: ['triage', 'fixer', 'reviewer'] },
  }
  return {
    ok: true,
    mode,
    objective,
    principle: '证据先于结论；副作用显式；可逆优先；验证覆盖真实路径。',
    stages: common,
    mode_overlay: overlays[mode],
    stop_conditions: ['缺少必要权限或凭据时停止并报告 blocker', '连续两次同一失败未改变证据时收敛为 PARTIAL/BLOCKED', '发现 secrets、工作区污染或不可逆写入风险时暂停发布'],
    final_output: ['结论', '证据表', '改动路径', '验证命令与结果', '剩余风险', '回滚/后续动作'],
  }
}

async function readSkill(skill: string): Promise<JsonValue> {
  const relativePath = SKILL_FILES[skill]
  if (!relativePath) throw new Error(`unknown skill: ${skill}`)
  const filePath = join(PACKAGE_ROOT, relativePath)
  const content = await readFile(filePath, 'utf8')
  return asJson({ skill, path: relativePath, content, bytes: Buffer.byteLength(content) })
}

export function apply(ctx: Context, config: Config = {}): void {
  const roots = configuredRoots(config)
  const maxFiles = config.maxFiles ?? 120
  const maxBytesPerFile = config.maxBytesPerFile ?? 160_000

  for (const skill of EMBEDDED_SKILLS) ctx.skills.register(skill)

  ctx.tools.register(defineTool({
    name: 'dsh_ops_capability_catalog',
    description: '列出 dsh-ops-kit 内置的 memory、证据编排、协作、benchmark 审计和插件发布能力。只读。',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    execute: () => Promise.resolve(asJson({ name, version: '0.1.0', read_only_tools: true, capabilities: CATALOG })),
  }))

  ctx.tools.register(defineTool({
    name: 'dsh_ops_workflow_plan',
    description: '为研究闭环、Git-first memory、fleet benchmark、插件发布或 incident review 生成证据驱动的结构化编排计划；只规划，不执行远程写入。',
    parameters: {
      mode: { type: 'string', required: true, enum: [...MODES], description: '编排模式。' },
      objective: { type: 'string', required: true, description: '本次任务的具体目标。' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    execute: args => {
      const objective = cleanText(args.objective, 2000)
      if (!objective) throw new Error('objective must not be empty')
      const mode = String(args.mode) as Mode
      if (!MODES.includes(mode)) throw new Error(`unknown mode: ${mode}`)
      return Promise.resolve(asJson(planFor(mode, objective)))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dsh_ops_skill_read',
    description: `读取本插件随包提供的完整技能说明。可读技能：${Object.keys(SKILL_FILES).join('、')}。`,
    parameters: { skill: { type: 'string', required: true, enum: Object.keys(SKILL_FILES), description: '技能标识。' } },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    execute: args => readSkill(String(args.skill)),
  }))

  ctx.tools.register(defineTool({
    name: 'dsh_ops_memory_search',
    description: '在配置根目录内对 Git-first memory/skill/document 文本做有上限的本地关键词检索；跳过 .git、secrets、runs、node_modules 等目录，不联网、不修改文件。',
    parameters: {
      query: { type: 'string', required: true, description: '一个或多个关键词，以空格分隔；所有关键词必须命中才返回。' },
      root: { type: 'string', description: '可选：配置根目录下的更窄子目录。' },
      limit: { type: 'integer', description: '最多返回文件数，默认 10，最大 50。' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    async execute(args) {
      const query = cleanText(args.query, 500).toLowerCase()
      const terms = query.split(/\s+/).filter(Boolean)
      if (terms.length === 0) throw new Error('query must not be empty')
      const limit = intOption(args.limit, 10, 1, 50, 'limit')
      const searchRoot = args.root ? assertAllowedPath(String(args.root), roots) : (roots[0] ?? canonical(process.cwd()))
      const files = await walkTextFiles(searchRoot, maxFiles)
      const hits: JsonObject[] = []
      // Every hit lands in an agent's context window, so cap the response by
      // size rather than by counting alone. The old shape — 20 files x 8
      // snippets x 300 chars, pretty-printed — could return over 40 KB for a
      // single common word, which is worse than useless: it crowds out the
      // context the answer was meant to inform.
      let budget = RESPONSE_BUDGET_BYTES
      let truncated = false
      for (const file of files) {
        if (!safePath(file)) continue
        let text
        try { text = await readFile(file, { encoding: 'utf8' }) } catch { continue }
        if (Buffer.byteLength(text) > maxBytesPerFile) text = text.slice(0, maxBytesPerFile)
        const lower = text.toLowerCase()
        if (!terms.every(term => lower.includes(term))) continue
        const lines = text.split('\n')
        const snippets = lines.map((line, index) => ({ line: index + 1, text: line.trim().slice(0, 200) }))
          .filter(item => terms.some(term => item.text.toLowerCase().includes(term)))
          .slice(0, 4)
        const hit = { relative: relative(searchRoot, file), snippets }
        const cost = Buffer.byteLength(JSON.stringify(hit))
        if (cost > budget) { truncated = true; break }
        budget -= cost
        hits.push(hit)
        // Reaching the limit means the scan stopped early, so there may well be
        // more matches we never looked at. Say so rather than implying the list
        // is complete.
        if (hits.length >= limit) { truncated = true; break }
      }
      return asJson({
        ok: true, root: searchRoot, query: terms, scanned_files: files.length,
        hits, truncated,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dsh_ops_repository_audit',
    description: '对一个配置根目录内的 Git 仓库做只读交付审计：分支/dirty 状态、候选敏感路径、未跟踪产物和基础文件清单；不提交、不清理、不上传。',
    parameters: { path: { type: 'string', required: true, description: '需要审计的仓库路径，必须位于配置 roots 内。' } },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    async execute(args) {
      const repository = assertAllowedPath(String(args.path), roots)
      const info = await stat(repository).catch(() => undefined)
      if (!info?.isDirectory()) throw new Error(`not a directory: ${repository}`)
      const git = await execFileAsync('git', ['-C', repository, 'status', '--short', '--branch'], { timeout: 3000, maxBuffer: 100_000 }).catch(error => ({ stdout: '', stderr: String(error) }))
      const files = await walkTextFiles(repository, Math.min(maxFiles, 80), 3)
      const sensitive = files.filter(file => !safePath(file)).map(file => relative(repository, file))
      const untracked = String(git.stdout).split('\n').filter(line => line.startsWith('?? ')).map(line => line.slice(3)).slice(0, 100)
      return asJson({
        ok: true,
        repository,
        git_status: String(git.stdout).trim(),
        clean: String(git.stdout).trim().split('\n').length <= 1,
        untracked,
        sensitive_candidates: sensitive,
        sampled_files: files.map(file => relative(repository, file)),
        ...(String(git.stderr || '').trim() ? { git_error: String(git.stderr).trim() } : {}),
        release_blockers: [
          ...(untracked.length > 0 ? ['untracked files must be reviewed before staging'] : []),
          ...(sensitive.length > 0 ? ['credential-like paths must be excluded from a public package'] : []),
          ...(String(git.stderr || '').trim() ? ['git status failed; do not infer cleanliness'] : []),
        ],
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dsh_ops_release_checklist',
    description: '生成 dsh-plugin 发布的完整 checklist：脱敏、构建、安装、profile 接入、版本发布和回滚；只生成清单。',
    parameters: { repository: { type: 'string', description: '可选：待发布仓库路径，写入清单上下文。' }, topic: { type: 'string', description: 'GitHub topic，默认 dsh-plugin。' } },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
      execute: args => Promise.resolve(asJson({
        ok: true,
        topic: cleanText(args.topic, 80) || 'dsh-plugin',
        ...(typeof args.repository === 'string' ? { repository: args.repository } : {}),
      before_commit: ['git status --short', 'rg secrets/tokens/api_key/.env', 'inspect package.json exports/files', 'remove credentials, runs, tmp and machine-local absolute paths'],
      validation: ['pnpm install --offline --ignore-scripts', 'pnpm build', 'pnpm typecheck', 'pnpm test', 'DSH profile install and restart', 'HTTP 200 + real tool catalog probe'],
      publication: ['create/fork repository', 'push branch or main intentionally', 'add dsh-plugin topic', 'publish README with install/config/limits/examples', 'open issue or PR to official ecosystem only with accurate authorship'],
      rollback: ['disable bundle row in profile patch', 'remove package from dsh.profile.bundles', 'restart DSH', 'retain commit and logs for diagnosis'],
      non_goals: ['no secret upload', 'no automatic remote issue creation', 'no destructive cleanup', 'no claim of official authorship'],
      })),
  }))

  /**
   * The executable counterpart to dsh_ops_release_checklist.
   *
   * The checklist tool returns a fixed list of things a releaser *should* do.
   * Nothing verifies that any of them happened, and that gap has already cost
   * this account real defects: a boot suite that printed SKIPPED and exited 0
   * (so `npm test` went green while the integration check never ran), and a
   * plugin left at `"private": true` (so it could never be published at all).
   * Both sat in repositories whose checklist runs had "passed".
   *
   * So this tool measures the repository instead of describing it. Read-only:
   * it does not edit files, install, publish, or reach the network.
   */
  ctx.tools.register(defineTool({
    name: 'dsh_ops_plugin_doctor',
    description: '对一个 DSH 插件仓库做可执行的发布前体检：dsh.bundle/cordis.patch.yml 是否真的可安装、private 是否挡住发布、官方包是否误放进 dependencies、boot 测试是否会静默跳过。只读，不改文件、不安装、不发布、不联网。',
    parameters: { path: { type: 'string', required: true, description: '插件仓库路径，必须位于配置 roots 内。' } },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    async execute(args) {
      const repository = assertAllowedPath(String(args.path), roots)
      const info = await stat(repository).catch(() => undefined)
      if (!info?.isDirectory()) throw new Error(`not a directory: ${repository}`)

      const pkgRaw = await readFile(join(repository, 'package.json'), 'utf8').catch(() => '')
      if (!pkgRaw) return asJson({ ok: false, repository, error: 'no package.json at repository root' })
      let pkg: JsonObject
      try { pkg = JSON.parse(pkgRaw) as JsonObject } catch (error) {
        return asJson({ ok: false, repository, error: `package.json is not valid JSON: ${String(error)}` })
      }

      const checks: Array<{ id: string, level: string, pass: boolean, detail: string }> = []
      const add = (id: string, level: 'blocker' | 'warning', pass: boolean, detail: string) => {
        checks.push({ id, level, pass, detail })
      }

      // Installability. A bundle manifest is what makes `dsh plugin add` work;
      // declaring only `dsh.client` is the ecosystem's most common rejection.
      const dsh = (pkg.dsh ?? {}) as JsonObject
      const bundle = dsh.bundle as JsonObject | undefined
      add('dsh.bundle declared', 'blocker', Boolean(bundle),
        bundle ? 'present' : '缺失：只声明 dsh.client 无法通过 dsh plugin add 安装')

      const patchRef = typeof bundle?.patch === 'string' ? bundle.patch : './cordis.patch.yml'
      const patchRaw = await readFile(join(repository, patchRef.replace(/^\.\//, '')), 'utf8').catch(() => '')
      add('cordis patch file exists', 'blocker', Boolean(patchRaw),
        patchRaw ? patchRef : `${patchRef} 不存在，profile 无法插入这个插件`)

      // A patch row naming a different package installs something else.
      // The captured token keeps whatever quoting the YAML used, so strip a
      // matched pair of surrounding quotes before comparing — without this the
      // check reported `'dsh-md-preview' !== dsh-md-preview` on every repo.
      const patchNames = [...patchRaw.matchAll(/^\s*name:\s*(\S+)/gm)]
        .map(match => match[1].replace(/^(['"])(.*)\1$/, '$2'))
      add('patch row matches package name', 'blocker',
        !patchRaw || patchNames.includes(String(pkg.name)),
        patchRaw ? `patch names=[${patchNames.join(', ')}] package.json name=${String(pkg.name)}` : 'skipped (no patch file)')

      // Publishability.
      add('publishable to npm', 'warning', pkg.private !== true,
        pkg.private === true ? '"private": true 会让 npm publish 直接失败' : 'not marked private')
      add('files[] declared', 'warning', Array.isArray(pkg.files) && pkg.files.length > 0,
        Array.isArray(pkg.files) ? `${pkg.files.length} entries` : '未声明 files[]，发布内容不可控')
      add('exports declared', 'warning', Boolean(pkg.exports),
        pkg.exports ? 'present' : '未声明 exports')

      // The host owns the harness version; pinning it as a hard dependency
      // installs a second copy alongside the profile's own.
      const runtimeDeps = Object.keys((pkg.dependencies ?? {}) as JsonObject)
      const misplaced = runtimeDeps.filter(dep => dep.startsWith('@deepseek-ai/'))
      add('harness packages kept as peers', 'warning', misplaced.length === 0,
        misplaced.length > 0 ? `应放进 peerDependencies：${misplaced.join(', ')}` : 'none in dependencies')

      // The defect this whole tool exists for: a boot suite that reports
      // SKIPPED and exits 0 is indistinguishable from a passing one in CI.
      const silentlySkipping: string[] = []
      for (const dir of ['test', 'tests']) {
        const entries = await readdir(join(repository, dir)).catch(() => [] as string[])
        for (const entry of entries.slice(0, 40)) {
          if (!entry.endsWith('.mjs')) continue
          const source = await readFile(join(repository, dir, entry), 'utf8').catch(() => '')
          if (!source.includes('SKIPPED') || !/process\.exit\(0\)/.test(source)) continue
          if (/process\.env\.[A-Z_]*STRICT/.test(source)) continue
          silentlySkipping.push(relative(repository, join(repository, dir, entry)))
        }
      }
      add('boot test cannot silently pass', 'blocker', silentlySkipping.length === 0,
        silentlySkipping.length > 0
          ? `${silentlySkipping.join(', ')}：打印 SKIPPED 后 process.exit(0) 且无 strict 环境变量兜底，CI 会显示绿勾但集成检查从未执行`
          : 'no silently-skipping boot suite found')

      const blockers = checks.filter(check => !check.pass && check.level === 'blocker')
      const warnings = checks.filter(check => !check.pass && check.level === 'warning')
      return asJson({
        ok: true,
        repository,
        package_name: String(pkg.name ?? ''),
        version: String(pkg.version ?? ''),
        installable: blockers.length === 0,
        checks,
        blockers: blockers.map(check => `${check.id}: ${check.detail}`),
        warnings: warnings.map(check => `${check.id}: ${check.detail}`),
        non_goals: ['read-only', 'no publish', 'no install', 'no network', 'no file mutation'],
      })
    },
  }))
}

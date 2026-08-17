// Integration test: does this package actually load in a real harness?
//
// test/index.test.ts drives apply() against a fake ctx and proves the tool
// logic is correct. It cannot catch the failure mode that broke three other
// plugins in this account before they were ever run for real: a package that
// imports cleanly, passes every unit test, and then registers nothing at all
// once a real cordis Context boots it — because `export const inject` never
// got satisfied, or because a hand-rolled fake service made a unit test lie.
//
// This plugin injects ['tools', 'skills'] (not 'fs' — it reads local files
// directly via node:fs, it does not go through the harness fs service). So
// this suite boots dsh-tools (provides `tools`) and dsh-skill (provides
// `skills`, via SkillRegistry extends Service — same self-registering shape
// as LocalFileSystem/FileSystem), then loads two independent first-party
// control plugins that inject the same services, so a registration failure
// on either control proves the *harness setup* is wrong, not this plugin.
//
// It needs the harness packages present, which they are inside a profile's
// node_modules but are not in a bare checkout of this repo. When they cannot
// be resolved the suite SKIPS rather than fails, so `npm test` still works
// from a clone. To run it for real:
//
//   cd ~/.dsh/profiles/<profile>/node_modules/dsh-ops-kit && node test/boot.test.mjs
//
// Run: node test/boot.test.mjs

import { mkdtemp, mkdir, writeFile, readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { rmSync } from 'node:fs'

const execFileAsync = promisify(execFile)

let failures = 0
const check = (label, ok, detail) => {
  if (ok) { console.log(`  ok    ${label}`); return }
  failures++
  console.log(`  FAIL  ${label}`)
  if (detail !== undefined) console.log(`        ${detail}`)
}

// dsh-fs-local subclasses dsh-fs; not needed by this plugin's own gate, but
// str_replace_editor (a control) injects ['tools', 'fs'], so it must be present
// for that control to register at all.
const REQUIRED = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-fs-local',
  '@deepseek-ai/dsh-tool-str-replace-editor',
  '@deepseek-ai/dsh-skill-filesystem',
]

const harness = {}
for (const specifier of REQUIRED) {
  try {
    harness[specifier] = await import(specifier)
  } catch (error) {
    console.log(`\n--- harness boot: SKIPPED ---`)
    console.log(`  ${specifier} is not resolvable from here (${error.code ?? 'error'}).`)
    console.log(`  Run this suite from inside an installed profile to exercise it.`)
    if (process.env.DSH_BOOT_STRICT === '1') {
      console.log(`  DSH_BOOT_STRICT=1: an unexercised boot check counts as a failure, not a pass.`)
      process.exit(1)
    }
    process.exit(0)
  }
}

console.log('\n--- harness boot ---')

const { Context } = harness['@deepseek-ai/cordis']
const asPlugin = (mod) => mod.default ?? mod

const ctx = new Context()
const warnings = []
ctx.on('internal/warning', (...args) => warnings.push(args.map(String).join(' ')))
const warnedAbout = (needle) => warnings.some(w => w.includes(needle))

await ctx.plugin(asPlugin(harness['@deepseek-ai/dsh-system-prompt']), {})
await ctx.plugin(asPlugin(harness['@deepseek-ai/dsh-tools']))
await ctx.plugin(asPlugin(harness['@deepseek-ai/dsh-skill']), {})
await ctx.plugin(asPlugin(harness['@deepseek-ai/dsh-fs-local']), {})
await new Promise((resolve) => setTimeout(resolve, 200))

check('the harness provides a real tools registry', ctx.tools !== undefined)
check('the harness provides a real skills registry', ctx.skills !== undefined,
  'without it this plugin is designed to stay unregistered, so the rest would prove nothing')

// ── controls: independent first-party plugins injecting the same services ──
// If either fails to register, the harness setup is wrong, not dsh-ops-kit.
await ctx.plugin(asPlugin(harness['@deepseek-ai/dsh-tool-str-replace-editor']), {})
await new Promise((resolve) => setTimeout(resolve, 100))
check('control (tools+fs gate): str_replace_editor registers',
  ctx.tools?.get?.('str_replace_editor') !== undefined,
  warnedAbout('str_replace_editor') ? `warned: ${warnings.join(' | ')}` : 'not registered and nothing warned')

await ctx.plugin(asPlugin(harness['@deepseek-ai/dsh-skill-filesystem']), {})
await new Promise((resolve) => setTimeout(resolve, 100))
check('control (skills gate): dsh-skill-filesystem loads without a harness warning',
  !warnedAbout('dsh-skill-filesystem'), warnings.join(' | '))

// ── load this package by its real installed name, as a profile would ──
const self = await import('dsh-ops-kit')
const scratch = await mkdtemp(join(tmpdir(), 'dsh-ops-kit-boot-'))
await ctx.plugin(self, { roots: [scratch] })
// Registration goes through defineTool's own module import, which lands a
// tick or two after plugin() resolves.
await new Promise((resolve) => setTimeout(resolve, 1000))

console.log('\n--- tool + skill registration ---')

const TOOL_NAMES = [
  'dsh_ops_capability_catalog',
  'dsh_ops_workflow_plan',
  'dsh_ops_skill_read',
  'dsh_ops_memory_search',
  'dsh_ops_repository_audit',
  'dsh_ops_release_checklist',
  'dsh_ops_plugin_doctor',
]
const tools = {}
for (const toolName of TOOL_NAMES) {
  tools[toolName] = ctx.tools?.get?.(toolName)
  check(`${toolName} reaches the real tool registry`, tools[toolName] !== undefined,
    warnedAbout('dsh-ops-kit') ? `warnings: ${warnings.join(' | ')}` : 'registry returned nothing and nothing warned')
}

if (Object.values(tools).some(t => t === undefined)) {
  console.log(`\nFAIL — ${failures} failing check(s)\n`)
  process.exit(1)
}

const SKILL_NAMES = ['memory-evidence', 'research-orchestration', 'fleet-orchestration', 'benchmark-evidence', 'dsh-plugin-release']

// The shipped contract, spelled out. Every capability pack here is user-visible in the
// README table; `runtime-doctor` is a tool-backed pack with no SKILL.md, which is why
// this list is one longer than SKILL_NAMES. Adding a pack or a stage should be a
// deliberate edit here, not a number that quietly moves.
const CAPABILITY_IDS = [...SKILL_NAMES, 'runtime-doctor']
const STAGE_IDS = ['scope', 'baseline', 'context', 'execute', 'verify', 'handoff']

const sameSet = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every(id => actual.includes(id))
const diffSet = (actual, expected) => {
  if (!Array.isArray(actual)) return `expected an array, got ${JSON.stringify(actual)}`
  const missing = expected.filter(id => !actual.includes(id))
  const extra = actual.filter(id => !expected.includes(id))
  return [
    missing.length ? `missing: ${missing.join(', ')}` : '',
    extra.length ? `undocumented: ${extra.join(', ')}` : '',
  ].filter(Boolean).join(' | ') || `got ${JSON.stringify(actual)}`
}
const skillList = await ctx.skills.list()
const skillNames = new Set(skillList.map(s => s.name))
for (const skillName of SKILL_NAMES) {
  check(`skill "${skillName}" reaches the real skills registry`, skillNames.has(skillName))
}

console.log('\n--- execute against real state (not a stub) ---')

try {
  // dsh_ops_capability_catalog: pure, deterministic.
  // Assert the exact ids, not the count: a bare `length === N` says "6 !== 5" without
  // naming what drifted, which is how a capability got added here with the suite stale.
  const catalog = await tools.dsh_ops_capability_catalog.execute({}, {})
  check('capability_catalog lists exactly the documented capability packs',
    sameSet(catalog.capabilities?.map(c => c.id), CAPABILITY_IDS), diffSet(catalog.capabilities?.map(c => c.id), CAPABILITY_IDS))

  // dsh_ops_workflow_plan: pure logic, but exercises the real MODES/overlays tables.
  const plan = await tools.dsh_ops_workflow_plan.execute({ mode: 'fleet-benchmark', objective: 'boot test' }, {})
  check('workflow_plan accepts the current (post-rename) mode enum', plan.mode === 'fleet-benchmark', JSON.stringify(plan))
  check('workflow_plan produces the documented evidence contract',
    sameSet(plan.stages?.map(s => s.id), STAGE_IDS), diffSet(plan.stages?.map(s => s.id), STAGE_IDS))

  // dsh_ops_skill_read: must return the *real* packaged file content, not a stub string.
  const skillRead = await tools.dsh_ops_skill_read.execute({ skill: 'memory-evidence' }, {})
  const onDisk = await readFile(new URL('../skills/memory-evidence/SKILL.md', import.meta.url), 'utf8')
  check('skill_read returns the exact bytes of the packaged SKILL.md', skillRead.content === onDisk,
    `tool returned ${skillRead.content?.length} bytes, disk file is ${onDisk.length} bytes`)

  // dsh_ops_repository_audit: real execFile('git', ...) shell-out against a real scratch repo.
  await execFileAsync('git', ['init', '-q'], { cwd: scratch })
  await execFileAsync('git', ['config', 'user.email', 'boot-test@example.invalid'], { cwd: scratch })
  await execFileAsync('git', ['config', 'user.name', 'boot test'], { cwd: scratch })
  await writeFile(join(scratch, 'tracked.md'), '# tracked\n')
  await execFileAsync('git', ['add', 'tracked.md'], { cwd: scratch })
  await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: scratch })
  await writeFile(join(scratch, 'untracked.md'), '# untracked\n')

  const audit = await tools.dsh_ops_repository_audit.execute({ path: scratch }, {})
  // assertAllowedPath canonicalizes through fs.realpath, so the audit reports
  // the real location it inspected.
  //
  // This file previously asserted the opposite, on the rationale that "a
  // path-safety check has no business following filesystem symlinks". That is
  // backwards for a *containment* check, and it was measured: with a root at
  // /safe and a symlink /safe/escape -> /outside, resolve()-only judged
  // /safe/escape to be inside /safe, so the tool would read and report on
  // files beyond the boundary the config declared. Resolving both sides is
  // what actually holds the boundary.
  //
  // mkdtemp returns a /var/... path on macOS, where /var is itself a symlink
  // to /private/var, so compare against the realpath rather than the raw name.
  const scratchReal = await realpath(scratch)
  check('repository_audit reports the canonical (symlink-resolved) repository path',
    audit.repository === scratchReal, `${audit.repository} !== ${scratchReal}`)
  check('repository_audit sees the real untracked file via real git status', audit.untracked?.includes('untracked.md'), JSON.stringify(audit.untracked))
  check('repository_audit correctly reports the repo as not clean', audit.clean === false)
  check('repository_audit flags the untracked file as a release blocker', audit.release_blockers?.some(b => b.includes('untracked')), JSON.stringify(audit.release_blockers))

  // dsh_ops_memory_search: real bounded file walk + keyword search against the same scratch dir.
  await writeFile(join(scratch, 'notes.md'), 'this file mentions the unique-token-xyzzy keyword\n')
  const search = await tools.dsh_ops_memory_search.execute({ query: 'unique-token-xyzzy' }, {})
  check('memory_search finds the real planted keyword on real disk', search.hits?.some(h => h.relative === 'notes.md'), JSON.stringify(search.hits?.map(h => h.relative)))

  // dsh_ops_release_checklist: a simple, real execute() proof of the last tool.
  const checklist = await tools.dsh_ops_release_checklist.execute({}, {})
  check('release_checklist returns the documented sections', Array.isArray(checklist.non_goals) && checklist.non_goals.length > 0, JSON.stringify(checklist))

  // dsh_ops_plugin_doctor: real checks against a real fixture on disk.
  //
  // The fixture deliberately reproduces the exact anti-pattern this tool
  // exists to catch — a boot suite that prints SKIPPED and exits 0 — so if the
  // detector ever stopped firing, this suite fails instead of passing
  // vacuously. That is the same failure mode the tool reports on, and asserting
  // only the healthy repos would reproduce it here.
  const fixture = join(scratch, 'plugin-fixture')
  await mkdir(join(fixture, 'test'), { recursive: true })
  await writeFile(join(fixture, 'package.json'), JSON.stringify({
    name: 'fixture-plugin',
    version: '1.0.0',
    private: true,
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }))
  // Quoted on purpose: the name comparison once failed on every real repo
  // because the capture kept the YAML quotes.
  await writeFile(join(fixture, 'cordis.patch.yml'), "- insert:\n    - id: fixture\n      name: 'fixture-plugin'\n")
  await writeFile(join(fixture, 'test', 'boot.test.mjs'), "console.log('--- harness boot: SKIPPED ---')\nprocess.exit(0)\n")

  const doctor = await tools.dsh_ops_plugin_doctor.execute({ path: fixture }, {})
  const doctorCheck = (id) => doctor.checks?.find(entry => entry.id === id)
  check('plugin_doctor detects a silently-skipping boot suite',
    doctorCheck('boot test cannot silently pass')?.pass === false,
    JSON.stringify(doctorCheck('boot test cannot silently pass')))
  check('plugin_doctor flags "private": true as a publish blocker',
    doctorCheck('publishable to npm')?.pass === false)
  check('plugin_doctor matches a quoted patch name against package.json',
    doctorCheck('patch row matches package name')?.pass === true,
    JSON.stringify(doctorCheck('patch row matches package name')))
  check('plugin_doctor reports a real dsh.bundle as present',
    doctorCheck('dsh.bundle declared')?.pass === true)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failing check(s)\n`)
process.exit(failures === 0 ? 0 : 1)

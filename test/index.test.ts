import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply } from '../src/index.ts'

function fakeContext() {
  const tools: Array<{ definition: { name: string; execute: (args: Record<string, unknown>) => Promise<unknown> | unknown } }> = []
  return {
    tools: { register(definition: typeof tools[number]['definition']) { tools.push({ definition }) } },
    skills: { register() { return () => undefined } },
    registered: tools,
  }
}

test('registers the complete read-only tool surface', () => {
  const context = fakeContext()
  apply(context as never)
  assert.deepEqual(context.registered.map(item => item.definition.name), [
    'dsh_ops_capability_catalog',
    'dsh_ops_workflow_plan',
    'dsh_ops_skill_read',
    'dsh_ops_memory_search',
    'dsh_ops_repository_audit',
    'dsh_ops_release_checklist',
    'dsh_ops_plugin_doctor',
  ])
})

test('generates a fleet benchmark plan without remote side effects', async () => {
  const context = fakeContext()
  apply(context as never)
  const tool = context.registered[1]?.definition
  assert.ok(tool)
  const value = await tool.execute({ mode: 'fleet-benchmark', objective: '验证共享工作树的成员交接' }) as Record<string, unknown>
  assert.equal(value.ok, true)
  assert.equal(value.mode, 'fleet-benchmark')
  assert.match(JSON.stringify(value), /leader-only dispatch/)
})

test('searches only the configured local root and returns line snippets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-ops-kit-'))
  await writeFile(join(root, 'memory.md'), '# Provenance\nThe source-backed memory is validated.\n', 'utf8')
  const context = fakeContext()
  apply(context as never, { roots: [root] })
  const tool = context.registered[3]?.definition
  assert.ok(tool)
  const value = await tool.execute({ query: 'source-backed validated' }) as Record<string, unknown>
  assert.equal(value.ok, true)
  assert.equal((value.hits as unknown[]).length, 1)
  assert.match(JSON.stringify(value), /source-backed memory/)
})

// Regression: the default root came from process.cwd(), which Node reports
// with symlinks already resolved, while the caller's own argument was only
// `resolve()`d. On macOS `/tmp` is a symlink to `/private/tmp`, so a directory
// that *was* the root got rejected as being outside it.
test('accepts a path that is the root but spelled through a symlink', async () => {
  const real = await mkdtemp(join(tmpdir(), 'dsh-ops-kit-link-'))
  const link = `${real}-alias`
  await symlink(real, link, 'dir')
  try {
    const context = fakeContext()
    apply(context as never, { roots: [real] })
    const tool = context.registered[4]?.definition
    assert.ok(tool)
    // Same directory, reached by its symlinked name.
    const value = await tool.execute({ path: link }) as Record<string, unknown>
    assert.equal(value.ok, true)
    assert.equal(value.repository, await realpath(real))
  } finally {
    await rm(link, { force: true })
  }
})

// Regression: 20 files x 8 snippets x 300 chars, pretty-printed, returned over
// 40 KB for one common keyword — which crowds out the very context the answer
// was meant to inform. The cap is a byte budget, not just a file count.
// Regression: a symlink *inside* a configured root that points outside it used
// to pass the containment check, because only `resolve()` was applied and
// `resolve()` does not follow symlinks. Measured: root /safe with
// /safe/escape -> /outside judged /safe/escape to be inside /safe, so the tool
// would read and report on files beyond the declared boundary.
test('refuses a symlink inside the root that escapes the root', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-ops-kit-safe-')))
  const outside = await realpath(await mkdtemp(join(tmpdir(), 'dsh-ops-kit-outside-')))
  await writeFile(join(outside, 'secret-notes.md'), 'beyond the boundary', 'utf8')
  await symlink(outside, join(root, 'escape'), 'dir')
  const context = fakeContext()
  apply(context as never, { roots: [root] })
  const tool = context.registered[4]?.definition
  assert.ok(tool)
  await assert.rejects(
    () => Promise.resolve(tool.execute({ path: join(root, 'escape') })),
    /outside configured roots/,
  )
})

test('caps the search response by bytes, not only by file count', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-ops-kit-big-'))
  const padded = Array.from({ length: 60 }, () =>
    'a padded line that mentions provenance repeatedly to make each hit expensive').join('\n')
  for (let i = 0; i < 40; i++) await writeFile(join(root, `doc-${i}.md`), padded, 'utf8')
  const context = fakeContext()
  apply(context as never, { roots: [root] })
  const tool = context.registered[3]?.definition
  assert.ok(tool)
  const value = await tool.execute({ query: 'provenance' }) as Record<string, unknown>
  const bytes = Buffer.byteLength(JSON.stringify(value))
  assert.ok(bytes < 16_000, `response was ${bytes} bytes, expected under 16000`)
  assert.equal(value.truncated, true, 'must admit results were withheld')
  assert.ok((value.hits as unknown[]).length > 0)
})

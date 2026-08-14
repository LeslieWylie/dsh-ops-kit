import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
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

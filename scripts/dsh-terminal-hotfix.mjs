#!/usr/bin/env node

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { delimiter, dirname, join, resolve } from 'node:path'

const require = createRequire(resolve(process.cwd(), 'package.json'))
const apply = process.argv.includes('--apply')

function packageRoot(name) {
  const resolvers = [require]
  const moduleRoots = [
    ...(process.env.DSH_NODE_MODULES?.split(delimiter) ?? []),
    ...(process.env.NODE_PATH?.split(delimiter) ?? []),
  ].filter(Boolean)
  for (const moduleRoot of moduleRoots) {
    try { resolvers.push(createRequire(join(dirname(moduleRoot), 'package.json'))) } catch { /* ignore invalid search roots */ }
  }
  for (const resolver of resolvers) {
    try { return dirname(resolver.resolve(`${name}/package.json`)) } catch { /* try next resolver */ }
  }
  return undefined
}

async function inspect() {
  const terminalRoot = packageRoot('@deepseek-ai/dsh-terminal-bash')
  const persistentRoot = packageRoot('@deepseek-ai/dsh-tool-bash-persistent')
  if (!terminalRoot || !persistentRoot) {
    return { status: 'unavailable', reason: 'both official bash packages must be installed in the current profile' }
  }
  const terminalPackage = JSON.parse(await readFile(join(terminalRoot, 'package.json'), 'utf8'))
  const persistentPackage = JSON.parse(await readFile(join(persistentRoot, 'package.json'), 'utf8'))
  const terminalEntry = join(terminalRoot, terminalPackage.main || 'lib/index.js')
  const persistentEntry = join(persistentRoot, persistentPackage.main || 'lib/index.js')
  const terminalSource = await readFile(terminalEntry, 'utf8')
  const persistentSource = await readFile(persistentEntry, 'utf8')
  const terminalMatch = terminalSource.match(/CONTROLLED_PROMPT\s*=\s*["']([^"']+)["']/)
  const persistentMatch = persistentSource.match(/SHELL_PROMPT\s*=\s*["']([^"']+)["']/)
  const lengthMatch = terminalSource.match(/Math\.max\(0,\s*([^)]*?)\s*-\s*this\.promptTail\.length\)/)
  const terminalPrompt = terminalMatch?.[1]
  const persistentPrompt = persistentMatch?.[1]
  const lengthExpression = lengthMatch?.[1]?.trim()
  const mismatch = terminalPrompt !== persistentPrompt
  const staleLength = lengthExpression === '6'
  return {
    status: !mismatch && !staleLength ? 'healthy' : 'degraded',
    terminal: { version: terminalPackage.version, entry: terminalEntry, prompt: terminalPrompt, length_expression: lengthExpression },
    persistent: { version: persistentPackage.version, entry: persistentEntry, prompt: persistentPrompt },
    mismatch,
    stale_length: staleLength,
  }
}

const before = await inspect()
if (before.status === 'unavailable' || before.status === 'healthy' || !apply) {
  process.stdout.write(`${JSON.stringify(before, null, 2)}\n`)
  process.exitCode = before.status === 'degraded' && !apply ? 1 : 0
} else {
  const entry = before.terminal.entry
  const source = await readFile(entry, 'utf8')
  const promptPattern = /const CONTROLLED_PROMPT\s*=\s*["']dsh> ["'];/
  const lengthPattern = /Math\.max\(0,\s*6\s*-\s*this\.promptTail\.length\)/
  if (!promptPattern.test(source) || !lengthPattern.test(source)) {
    throw new Error('refusing to patch: official entry does not match the known rc.6 layout')
  }
  const backup = `${entry}.bak.dsh-terminal-hotfix-${new Date().toISOString().replace(/[:.]/g, '-')}`
  await copyFile(entry, backup)
  const patched = source
    .replace(promptPattern, 'const CONTROLLED_PROMPT = "__DSH_PERSISTENT_BASH_PROMPT__ ";')
    .replace(lengthPattern, 'Math.max(0, CONTROLLED_PROMPT.length + 1 - this.promptTail.length)')
  await writeFile(entry, patched, 'utf8')
  const after = await inspect()
  process.stdout.write(`${JSON.stringify({ before, after, backup }, null, 2)}\n`)
  if (after.status !== 'healthy') {
    throw new Error('hotfix verification failed; restore the reported backup before retrying')
  }
}

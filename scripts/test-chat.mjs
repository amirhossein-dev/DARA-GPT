import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const out = mkdtempSync(join(tmpdir(), 'dara-chat-tests-'))
try {
  const nativeGlobals = join(out, 'native-globals.d.ts')
  const nodeSetup = join(out, 'node-setup.cjs')
  writeFileSync(nativeGlobals, 'declare const __DEV__: boolean;\n')
  writeFileSync(nodeSetup, 'globalThis.__DEV__ = false;\n')
  const compiled = spawnSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--strict', '--esModuleInterop', '--skipLibCheck', '--lib', 'ES2022,DOM', '--types', 'node', '--typeRoots', resolve('node_modules/@types'), '--outDir', out, nativeGlobals, 'test/chat.test.ts'], { stdio: 'inherit' })
  if (compiled.status !== 0) process.exitCode = compiled.status || 1
  else {
    const run = spawnSync(process.execPath, ['--require', nodeSetup, '--test', join(out, 'test/chat.test.js')], { stdio: 'inherit', env: { ...process.env, NODE_PATH: resolve('node_modules') } })
    process.exitCode = run.status || 0
  }
} finally { rmSync(out, { recursive: true, force: true }) }

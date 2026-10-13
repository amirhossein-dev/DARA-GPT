import {spawnSync} from 'node:child_process'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const out=mkdtempSync(join(tmpdir(),'dara-identity-tests-'))
try {
  // The standalone Node runner needs React Native's compile-time and runtime global.
  const nativeGlobals=join(out,'native-globals.d.ts')
  const nodeSetup=join(out,'node-setup.cjs')
  writeFileSync(nativeGlobals,'declare const __DEV__: boolean;\n')
  writeFileSync(nodeSetup,'globalThis.__DEV__ = false;\n')
  const tsc=resolve('node_modules/typescript/bin/tsc')
  const args=[tsc,'--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--esModuleInterop','--skipLibCheck','--lib','ES2022,DOM','--types','node','--typeRoots',resolve('node_modules/@types'),'--outDir',out,nativeGlobals,'test/identity-client.test.ts']
  const compiled=spawnSync(process.execPath,args,{stdio:'inherit'})
  if(compiled.status!==0)process.exitCode=compiled.status||1
  else {const r=spawnSync(process.execPath,['--require',nodeSetup,'--test',join(out,'test/identity-client.test.js')],{stdio:'inherit'});process.exitCode=r.status||0}
} finally {rmSync(out,{recursive:true,force:true})}

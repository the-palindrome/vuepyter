import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const esmTypes = path.join(distDir, 'index.d.ts')
const cjsTypes = path.join(distDir, 'index.d.cts')

if (!existsSync(esmTypes)) {
  throw new Error(`Expected declaration file at ${esmTypes}`)
}

copyFileSync(esmTypes, cjsTypes)

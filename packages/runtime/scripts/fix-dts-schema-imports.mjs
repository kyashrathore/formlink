import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (ent) => {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) return walk(full)
    if (ent.isFile() && full.endsWith('.d.ts')) return [full]
    return []
  }))
  return files.flat()
}

async function main() {
  const files = await walk(distDir)
  for (const file of files) {
    if (file.endsWith(path.join('schema', 'index.d.ts'))) continue
    const text = await fs.readFile(file, 'utf8')
    const next = text
      .replace(/from\s+'@formlink\/schema'/g, "from './schema/index'")
      .replace(/import\s+'@formlink\/schema';/g, "import './schema/index';")
    if (next !== text) {
      await fs.writeFile(file, next, 'utf8')
      console.log('[fix-dts] Rewrote schema imports in', path.relative(distDir, file))
    }
  }
}

main().catch((err) => {
  console.error('[fix-dts] Error:', err)
  process.exitCode = 1
})

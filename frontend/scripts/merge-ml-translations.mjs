import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const repoRoot = path.join(root, '..')

const enPath = path.join(root, 'src/i18n/messages/en.ts')
const mlOutPath = path.join(root, 'src/i18n/messages/ml.ts')

// Load user translations via dynamic import (copy to .mjs)
const tempPath = path.join(root, 'scripts', '_malayalam_import.mjs')
const srcPath = path.join(repoRoot, 'malayalamtext.md.ts')
let src = fs.readFileSync(srcPath, 'utf8')
src = src.replace('export const malayalamTranslations', 'export const translations')
src = src.replace(/\.ts'?$/, '') 
fs.writeFileSync(tempPath, src.replace(/\.md\.ts/, '') + '\n', 'utf8')
// Fix extension - write as .mjs content
fs.writeFileSync(
  tempPath,
  src.replace('malayalamTranslations', 'translations').replace(/;\s*$/, ''),
)
const { translations: newMl } = await import('./_malayalam_import.mjs')

// Fix typo
if (newMl['apply.benefits1'] && !newMl['apply.benefit1']) {
  newMl['apply.benefit1'] = newMl['apply.benefits1']
  delete newMl['apply.benefits1']
}

const enContent = fs.readFileSync(enPath, 'utf8')
const enKeys = [...enContent.matchAll(/'([^']+)':/g)].map((x) => x[1])

// Load current ml for fallback
const oldMl = {}
const oldContent = fs.readFileSync(mlOutPath, 'utf8')
const entryRe = /'([^']+)':\s*(?:'((?:\\.|[^'\\])*)'|\n\s*'((?:\\.|[^'\\])*)')/g
let m
while ((m = entryRe.exec(oldContent)) !== null) {
  oldMl[m[1]] = (m[2] ?? m[3] ?? '').replace(/\\'/g, "'")
}

const merged = {}
const missing = []
for (const key of enKeys) {
  if (newMl[key] !== undefined) merged[key] = newMl[key]
  else if (oldMl[key] !== undefined) merged[key] = oldMl[key]
  else {
    merged[key] = oldMl[key] ?? `[MISSING: ${key}]`
    missing.push(key)
  }
}

console.log('User translations:', Object.keys(newMl).length)
console.log('Missing from user file (using old ml):', missing.length)
if (missing.length) console.log(missing.join(', '))

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

let out = "import type { MessageKey } from '@/i18n/messages/en'\n\nexport const mlMessages: Record<MessageKey, string> = {\n"
for (const key of enKeys) {
  const val = merged[key]
  if (val.length > 80 && !val.includes('\n')) {
    out += `  '${key}':\n    '${esc(val)}',\n`
  } else if (val.includes('\n')) {
    out += `  '${key}':\n    '${esc(val)}',\n`
  } else {
    out += `  '${key}': '${esc(val)}',\n`
  }
}
out += '}\n'

fs.writeFileSync(mlOutPath, out, 'utf8')
fs.unlinkSync(tempPath)
console.log('Wrote', mlOutPath)

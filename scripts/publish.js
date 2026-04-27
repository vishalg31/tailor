#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..')
const DEST = path.join('C:', 'Users', 'gyvsh', 'Desktop', 'New folder (2)', 'vishal-git', 'tailor')

const EXCLUDE = [
  'node_modules',
  '.next',
  '.env',
  '.env.local',
  'CV sample',
  'CLAUDE.md',
  'tsconfig.tsbuildinfo',
  '.git',
]

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    if (EXCLUDE.includes(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

console.log('\n📦  Publishing Tailor to vishal-git...\n')
console.log(`    From: ${SRC}`)
console.log(`    To:   ${DEST}\n`)

copyDir(SRC, DEST)

console.log('✅  Copy complete.')
console.log('\nNext steps:')
console.log(`  cd "${DEST}"`)
console.log('  git init          ← first time only')
console.log('  git add .')
console.log('  git commit -m "deploy: tailor"')
console.log('  git push\n')

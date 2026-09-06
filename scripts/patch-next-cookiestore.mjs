import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  join(root, 'node_modules/next/dist/client/components/segment-cache/navigation-testing-lock.js'),
  join(root, 'node_modules/next/dist/esm/client/components/segment-cache/navigation-testing-lock.js'),
]

const replacements = [
  {
    from: "if (typeof cookieStore === 'undefined') {",
    to: "if (typeof cookieStore === 'undefined' || typeof cookieStore.addEventListener !== 'function') {",
  },
  {
    from: "if (typeof cookieStore !== 'undefined') {",
    to: "if (typeof cookieStore !== 'undefined' && typeof cookieStore.get === 'function') {",
  },
]

let changed = 0
for (const file of targets) {
  let src = readFileSync(file, 'utf8')
  let before = src
  for (const { from, to } of replacements) {
    if (src.includes(from)) {
      src = src.split(from).join(to)
    }
  }
  if (src !== before) {
    writeFileSync(file, src)
    console.log(`patched: ${file}`)
    changed++
  }
}

if (changed === 0) {
  console.log('no patches needed (already applied or files missing)')
}
// Regenerate src/data/versions.json from the ESE VersionSort TJA drive.
// Usage: node scripts/generate-versions.mjs [path-to-VersionSort]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2] ?? '/run/media/yonokid/HDD/TJAs/ESE/VersionSort'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/data/versions.json')
const CATEGORIES = ['Arcade', 'Console'] // Template is a genre scaffold, not a real version

function findSongLists(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...findSongLists(full))
    else if (entry === 'song_list.txt') files.push(full)
  }
  return files
}

function hashesFromLine(line) {
  const field = line.split('|', 1)[0]?.trim()
  if (!field || field.length % 32 !== 0) return []
  const out = []
  for (let i = 0; i < field.length; i += 32) out.push(field.slice(i, i + 32))
  return out
}

const versions = {}
for (const category of CATEGORIES) {
  const categoryDir = join(root, category)
  for (const versionName of readdirSync(categoryDir).sort()) {
    const versionDir = join(categoryDir, versionName)
    if (!statSync(versionDir).isDirectory()) continue
    const hashes = new Set()
    for (const file of findSongLists(versionDir)) {
      const text = readFileSync(file, 'utf-8')
      for (const line of text.split('\n')) {
        for (const h of hashesFromLine(line)) hashes.add(h)
      }
    }
    if (hashes.size > 0) versions[`${category}/${versionName}`] = [...hashes]
  }
}

writeFileSync(OUT, JSON.stringify(versions))
console.log(`Wrote ${Object.keys(versions).length} versions to ${OUT}`)

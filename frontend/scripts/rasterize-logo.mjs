import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = dirname(fileURLToPath(import.meta.url))
const pub = join(root, '..', 'public')
const svgPath = join(pub, 'favicon.svg')
const svg = await readFile(svgPath)

async function out(name, size) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .ensureAlpha()
    .png()
    .toFile(join(pub, name))
}

await out('icon-192.png', 192)
await out('icon-512.png', 512)
await out('apple-touch-icon.png', 180)

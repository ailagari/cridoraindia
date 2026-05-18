import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = dirname(fileURLToPath(import.meta.url))
const pub = join(root, '..', 'public')
const androidRes = join(root, '..', 'android', 'app', 'src', 'main', 'res')
const sourcePath = join(pub, 'icon-512.png')

const DENSITIES = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
]

const PWA_BG = '#000814'

async function writeLauncherIcon(outPath, size) {
  const logoSize = Math.round(size * 0.88)
  const logo = await sharp(sourcePath).resize(logoSize, logoSize).png().toBuffer()
  const offset = Math.round((size - logoSize) / 2)
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: PWA_BG,
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(outPath)
}

async function writeAdaptiveForeground(outPath, canvas) {
  const logoSize = Math.round(canvas * 0.72)
  const logo = await sharp(sourcePath).resize(logoSize, logoSize).png().toBuffer()
  const offset = Math.round((canvas - logoSize) / 2)
  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(outPath)
}

for (const { folder, launcher, foreground } of DENSITIES) {
  const dir = join(androidRes, folder)
  await mkdir(dir, { recursive: true })
  await writeLauncherIcon(join(dir, 'ic_launcher.png'), launcher)
  await writeLauncherIcon(join(dir, 'ic_launcher_round.png'), launcher)
  await writeAdaptiveForeground(join(dir, 'ic_launcher_foreground.png'), foreground)
}

console.log('[android:icons] Generated launcher icons from public/icon-512.png')

// Рендер иконок из SVG в PNG (iOS не понимает SVG для экрана «Домой»).
// node icons/render.mjs [вариант]  — без аргумента собирает превью всех вариантов
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

import { fileURLToPath } from 'node:url'
const dir = fileURLToPath(new URL('.', import.meta.url))
const pub = fileURLToPath(new URL('../public/', import.meta.url))
const pick = process.argv[2]

if (pick) {
  const svg = readFileSync(dir + pick + '.svg')
  for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    await sharp(svg, { density: 300 }).resize(size, size).png().toFile(pub + name)
  }
  await sharp(svg, { density: 300 }).resize(64, 64).png().toFile(pub + 'favicon.png')
  console.log('icons written for', pick)
} else {
  const { readdirSync } = await import('node:fs')
  const variants = process.env.ONLY ? process.env.ONLY.split(',') : readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort()
  const cols = Number(process.env.COLS ?? 3), rows = Math.ceil(variants.length / cols)
  const S = 280, gap = 56, W = cols * (S + gap) + gap, rowH = S + gap + 50
  const mask = Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S * 0.225}"/></svg>`)
  const tiles = await Promise.all(variants.map(async (v) =>
    sharp(await sharp(readFileSync(dir + v + '.svg'), { density: 300 }).resize(S, S).png().toBuffer())
      .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()))
  const H = rows * rowH + gap
  const labels = Buffer.from(`<svg width="${W}" height="${H}">${variants.map((v, i) =>
    `<text x="${gap + (i % cols) * (S + gap) + S / 2}" y="${gap + Math.floor(i / cols) * rowH + S + 38}" font-family="Helvetica" font-size="30" text-anchor="middle" fill="#222">${Number(process.env.START ?? 1) + i}</text>`).join('')}</svg>`)
  await sharp({ create: { width: W, height: H, channels: 4, background: '#ECECF1' } })
    .composite([...tiles.map((t, i) => ({ input: t, left: gap + (i % cols) * (S + gap), top: gap + Math.floor(i / cols) * rowH })), { input: labels, left: 0, top: 0 }])
    .png().toFile(dir + 'preview.png')
  console.log('preview.png')
}

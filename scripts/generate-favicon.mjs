import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(root, 'app')
const publicSource = path.join(root, 'public', 'assets', 'favicon-source.png')

const sizes = [16, 32, 48]

/** Corner radius as a fraction of edge length — matches common app-icon rounding. */
const CORNER_RATIO = 0.22

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function loadSource() {
  const candidates = [
    publicSource,
    path.join(
      root,
      'assets',
      'c__Users_craig_AppData_Roaming_Cursor_User_workspaceStorage_e2f96a29dcdeb02060085a9609efa6a7_images_signara-favicon_4-ee82dd2d-6014-4de7-90f7-2665b41f07b8.png'
    ),
    path.join(appDir, 'apple-icon.png'),
    path.join(appDir, 'icon.png'),
  ]

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return sharp(candidate).toBuffer()
    }
  }

  throw new Error('No favicon source image found')
}

function roundedMaskSvg(size, radius) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>
    </svg>`
  )
}

async function renderIcon(source, size) {
  const radius = Math.max(2, Math.round(size * CORNER_RATIO))

  const resized = await sharp(source)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .ensureAlpha()
    .png()
    .toBuffer()

  return sharp(resized)
    .composite([{ input: roundedMaskSvg(size, radius), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function main() {
  const source = await loadSource()

  if (!(await fileExists(publicSource))) {
    await sharp(source).png().toFile(publicSource)
  }

  const pngs = await Promise.all(sizes.map((size) => renderIcon(source, size)))

  const ico = buildIco(pngs, sizes)
  await writeFile(path.join(appDir, 'favicon.ico'), ico)
  await writeFile(path.join(appDir, 'icon.png'), await renderIcon(source, 32))
  await writeFile(path.join(appDir, 'apple-icon.png'), await renderIcon(source, 180))

  console.log('Generated rounded favicon.ico, icon.png (32px), apple-icon.png (180px)')
}

function buildIco(images, dimensions) {
  const count = images.length
  const headerSize = 6 + count * 16
  let offset = headerSize
  const entries = images.map((buf, i) => {
    const entry = {
      width: dimensions[i] >= 256 ? 0 : dimensions[i],
      height: dimensions[i] >= 256 ? 0 : dimensions[i],
      size: buf.length,
      offset,
    }
    offset += buf.length
    return entry
  })

  const out = Buffer.alloc(offset)

  out.writeUInt16LE(0, 0)
  out.writeUInt16LE(1, 2)
  out.writeUInt16LE(count, 4)

  let dirOffset = 6
  for (let i = 0; i < count; i++) {
    const { width, height, size, offset: dataOffset } = entries[i]
    out.writeUInt8(width, dirOffset)
    out.writeUInt8(height, dirOffset + 1)
    out.writeUInt8(0, dirOffset + 2)
    out.writeUInt8(0, dirOffset + 3)
    out.writeUInt16LE(1, dirOffset + 4)
    out.writeUInt16LE(32, dirOffset + 6)
    out.writeUInt32LE(size, dirOffset + 8)
    out.writeUInt32LE(dataOffset, dirOffset + 12)
    dirOffset += 16
  }

  let dataOffset = headerSize
  for (const buf of images) {
    buf.copy(out, dataOffset)
    dataOffset += buf.length
  }

  return out
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

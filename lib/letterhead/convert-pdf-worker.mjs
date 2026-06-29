import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  A4_LETTERHEAD_HEIGHT_PX,
  A4_LETTERHEAD_WIDTH_PX,
  LETTERHEAD_RENDER_DPI,
  drawContainTop,
} from './letterhead-a4.mjs'

const PDF_RENDER_SCALE = LETTERHEAD_RENDER_DPI / 72
const PDFJS_DIST_DIR = path.join(process.cwd(), 'node_modules/pdfjs-dist')

globalThis.Path2D = Path2D
globalThis.DOMMatrix = DOMMatrix

function getPdfJsAssetUrl(...segments) {
  return `${pathToFileURL(path.join(PDFJS_DIST_DIR, ...segments)).href}/`
}

async function readStdinBuffer() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function convertPdfFirstPageToPng(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer)

  const document = await getDocument({
    data,
    useSystemFonts: true,
    standardFontDataUrl: getPdfJsAssetUrl('standard_fonts'),
    cMapUrl: getPdfJsAssetUrl('cmaps'),
    cMapPacked: true,
    wasmUrl: getPdfJsAssetUrl('wasm'),
  }).promise

  try {
    if (document.numPages < 1) {
      throw new Error('PDF has no pages.')
    }

    const page = await document.getPage(1)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
    const sourceCanvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const sourceContext = sourceCanvas.getContext('2d')

    sourceContext.fillStyle = '#ffffff'
    sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height)

    await page.render({
      canvas: sourceCanvas,
      viewport,
      intent: 'print',
    }).promise

    const outputCanvas = createCanvas(A4_LETTERHEAD_WIDTH_PX, A4_LETTERHEAD_HEIGHT_PX)
    const outputContext = outputCanvas.getContext('2d')

    outputContext.fillStyle = '#ffffff'
    outputContext.fillRect(0, 0, A4_LETTERHEAD_WIDTH_PX, A4_LETTERHEAD_HEIGHT_PX)
    drawContainTop(outputContext, sourceCanvas, A4_LETTERHEAD_WIDTH_PX, A4_LETTERHEAD_HEIGHT_PX)

    return outputCanvas.toBuffer('image/png')
  } finally {
    await document.destroy()
  }
}

async function main() {
  const pdfBuffer = await readStdinBuffer()
  if (!pdfBuffer.length) {
    throw new Error('No PDF data received.')
  }

  const pngBuffer = await convertPdfFirstPageToPng(pdfBuffer)
  process.stdout.write(pngBuffer)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

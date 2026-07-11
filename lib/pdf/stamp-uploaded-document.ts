import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatPdfDateValue } from '@/lib/pdf/format-values'
import { percentToPdfPoints } from '@/lib/templates/coordinate-utils'
import type { FieldPosition } from '@/types/database'

export interface StampUploadedDocumentInput {
  sourceFileUrl: string
  fieldPositions: FieldPosition[]
  fieldValues: Record<string, unknown>
  /** Embeddable signature sources keyed by fieldId (data URLs or http URLs). */
  signatureImages: Record<string, string | null>
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    if (comma < 0) throw new Error('Invalid data URL')
    const header = url.slice(0, comma)
    const data = url.slice(comma + 1)
    if (header.includes(';base64')) {
      return Uint8Array.from(Buffer.from(data, 'base64'))
    }
    return Uint8Array.from(Buffer.from(decodeURIComponent(data), 'utf8'))
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF source (${response.status})`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

/**
 * Stamp submitted field values and signature images onto an uploaded PDF template.
 * Does not append the audit trail — merge that separately with `mergePdfBuffers`.
 */
export async function stampUploadedDocument(
  input: StampUploadedDocumentInput
): Promise<Buffer> {
  const sourceBytes = await fetchBytes(input.sourceFileUrl)
  const pdfDoc = await PDFDocument.load(sourceBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  for (const field of input.fieldPositions ?? []) {
    if (field.page < 0 || field.page >= pages.length) continue

    const page = pages[field.page]
    const { width: pageWidth, height: pageHeight } = page.getSize()
    const { pdfX, pdfY, pdfWidth, pdfHeight } = percentToPdfPoints(
      field,
      pageWidth,
      pageHeight
    )

    const value = input.fieldValues[field.fieldId]

    switch (field.fieldType) {
      case 'file':
        // Attachments are listed on the audit trail, not stamped onto the page.
        break

      case 'checkbox': {
        if (!value) break
        const markSize = Math.min(pdfHeight * 0.75, 12)
        page.drawText('X', {
          x: pdfX + pdfWidth / 2 - markSize / 3,
          y: pdfY + (pdfHeight - markSize) / 2,
          size: markSize,
          font,
          color: rgb(0.06, 0.17, 0.35),
        })
        break
      }

      case 'signature': {
        const imageSrc = input.signatureImages[field.fieldId]
        if (!imageSrc || imageSrc === 'physical') break

        try {
          const imageBytes = await fetchBytes(imageSrc)
          const embedded = isPng(imageBytes)
            ? await pdfDoc.embedPng(imageBytes)
            : isJpeg(imageBytes)
              ? await pdfDoc.embedJpg(imageBytes)
              : null
          if (!embedded) break

          page.drawImage(embedded, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
          })
        } catch (err) {
          console.error('[stampUploadedDocument] signature embed failed', field.fieldId, err)
        }
        break
      }

      case 'date': {
        const text = formatPdfDateValue(value)
        if (text === '—') break
        const size = Math.min(10, Math.max(7, pdfHeight * 0.55))
        page.drawText(text, {
          x: pdfX + 2,
          y: pdfY + Math.max(2, (pdfHeight - size) / 2),
          size,
          font,
          color: rgb(0.06, 0.17, 0.35),
          maxWidth: Math.max(8, pdfWidth - 4),
        })
        break
      }

      default: {
        if (value === null || value === undefined || value === '') break
        const text = String(value)
        const size = Math.min(10, Math.max(7, pdfHeight * 0.55))
        page.drawText(text, {
          x: pdfX + 2,
          y: pdfY + Math.max(2, (pdfHeight - size) / 2),
          size,
          font,
          color: rgb(0.06, 0.17, 0.35),
          maxWidth: Math.max(8, pdfWidth - 4),
        })
        break
      }
    }
  }

  const saved = await pdfDoc.save()
  return Buffer.from(saved)
}

/** Append every page from `appendixPdf` onto the end of `basePdf`. */
export async function mergePdfBuffers(
  basePdf: Buffer | Uint8Array,
  appendixPdf: Buffer | Uint8Array
): Promise<Buffer> {
  const base = await PDFDocument.load(basePdf)
  const appendix = await PDFDocument.load(appendixPdf)
  const pages = await base.copyPages(appendix, appendix.getPageIndices())
  for (const page of pages) {
    base.addPage(page)
  }
  const saved = await base.save()
  return Buffer.from(saved)
}

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89

/**
 * Turn a stored attachment (PDF or raster image) into a PDF buffer so it can
 * be merged after an audit-trail page.
 */
export async function bytesToPdfDocument(
  bytes: Buffer | Uint8Array,
  hint: { contentType?: string; path?: string }
): Promise<Buffer> {
  const lowerPath = (hint.path ?? '').toLowerCase()
  const type = (hint.contentType ?? '').toLowerCase()
  const isPdf =
    type === 'application/pdf' ||
    lowerPath.endsWith('.pdf') ||
    (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)

  if (isPdf) {
    // Re-save through pdf-lib to normalise / validate.
    const loaded = await PDFDocument.load(bytes)
    return Buffer.from(await loaded.save())
  }

  const pdfDoc = await PDFDocument.create()
  const isPng = type.includes('png') || lowerPath.endsWith('.png')
  const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)

  const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
  const margin = 28
  const maxW = A4_WIDTH_PT - margin * 2
  const maxH = A4_HEIGHT_PT - margin * 2
  const scale = Math.min(maxW / image.width, maxH / image.height, 1)
  const width = image.width * scale
  const height = image.height * scale
  page.drawImage(image, {
    x: (A4_WIDTH_PT - width) / 2,
    y: (A4_HEIGHT_PT - height) / 2,
    width,
    height,
  })

  return Buffer.from(await pdfDoc.save())
}


import 'server-only'

import { spawn } from 'node:child_process'
import path from 'node:path'
import type { PageOrientation } from '@/types/database'

/** Render letterhead PDFs at print resolution (A4 ≈ 2480×3508 px). */
export const LETTERHEAD_RENDER_DPI = 300

const WORKER_PATH = path.join(process.cwd(), 'lib/letterhead/convert-pdf-worker.mjs')
const CONVERSION_TIMEOUT_MS = 60_000
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024

export async function convertPdfFirstPageToPng(
  pdfBuffer: Buffer,
  orientation: PageOrientation = 'portrait'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LETTERHEAD_ORIENTATION: orientation,
      },
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let stdoutBytes = 0
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error('PDF conversion timed out.'))
    }, CONVERSION_TIMEOUT_MS)

    const finish = (error: Error | null, result?: Buffer) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(result!)
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        child.kill()
        finish(new Error('Converted PNG is too large.'))
        return
      }
      stdoutChunks.push(chunk)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk)
    })

    child.on('error', (error) => {
      finish(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        finish(null, Buffer.concat(stdoutChunks))
        return
      }

      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
      finish(new Error(stderr || `PDF conversion failed with exit code ${code}.`))
    })

    child.stdin.end(pdfBuffer)
  })
}

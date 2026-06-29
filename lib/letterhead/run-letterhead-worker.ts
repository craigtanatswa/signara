import 'server-only'

import { spawn } from 'node:child_process'
import path from 'node:path'

const CONVERSION_TIMEOUT_MS = 60_000
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024

export async function runLetterheadWorker(
  workerFileName: string,
  inputBuffer: Buffer
): Promise<Buffer> {
  const workerPath = path.join(process.cwd(), 'lib/letterhead', workerFileName)

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let stdoutBytes = 0
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error('Letterhead processing timed out.'))
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
        finish(new Error('Processed letterhead image is too large.'))
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
      finish(new Error(stderr || `Letterhead worker failed with exit code ${code}.`))
    })

    child.stdin.end(inputBuffer)
  })
}

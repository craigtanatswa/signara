import { saveUserSignature } from '@/app/actions/signatures'
import type { SignatureCaptureMethod } from '@/types/database'

/**
 * Persist a signature to the user's library after an explicit confirm
 * (Save button on the pad). Prefer folding library saves into approve/submit
 * server actions for those flows — sequential client actions can break RSC.
 * Failures are logged and never block the action.
 */
export async function saveSignatureForFutureUse(
  dataUrl: string | null | undefined,
  method: SignatureCaptureMethod = 'draw'
): Promise<void> {
  if (!dataUrl?.startsWith('data:image/')) return

  try {
    const result = await saveUserSignature({
      imageData: dataUrl,
      method,
      setAsDefault: true,
      replaceIfFull: true,
    })
    if (result.error) {
      console.error('[saveSignatureForFutureUse]', result.error)
    }
  } catch (err) {
    console.error('[saveSignatureForFutureUse]', err)
  }
}

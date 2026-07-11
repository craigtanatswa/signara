import { Image, StyleSheet } from '@react-pdf/renderer'
import QRCode from 'qrcode'

const styles = StyleSheet.create({
  image: {
    width: 64,
    height: 64,
  },
})

/**
 * Generate a QR code PNG as a data URL (server-side, before PDF render).
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 160,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F2C59',
      light: '#FFFFFF',
    },
  })
}

/**
 * Embed a pre-generated QR code data URL in a react-pdf document.
 */
export function QrCodeImage({
  src,
  size = 64,
}: {
  src: string
  size?: number
}) {
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- QR code in PDF output
    <Image src={src} style={[styles.image, { width: size, height: size }]} />
  )
}

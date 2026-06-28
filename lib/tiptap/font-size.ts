/** Word-style document font sizes — stored and rendered in points. */
export const TEMPLATE_FONT_SIZES_PT = [
  '10pt',
  '11pt',
  '12pt',
  '14pt',
  '16pt',
  '18pt',
  '20pt',
  '24pt',
  '28pt',
  '32pt',
] as const

export const DEFAULT_TEMPLATE_FONT_SIZE_PT = '11pt'

/** Normalize legacy px values to pt using the same numeric value (Word convention). */
export function normalizeFontSize(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null

  const match = value.trim().match(/^([\d.]+)\s*(px|pt)?$/i)
  if (!match) return null

  return `${match[1]}pt`
}

export function formatFontSizeLabel(size: string): string {
  return size.replace(/pt$/i, '')
}

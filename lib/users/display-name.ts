/**
 * Formats a user's name for mentions across the product.
 * When a position is set: "John Doe - Human Resources Officer"
 */
export function formatUserDisplayName(
  fullName: string,
  position?: string | null
): string {
  const trimmed = position?.trim()
  if (!trimmed) return fullName
  return `${fullName} - ${trimmed}`
}

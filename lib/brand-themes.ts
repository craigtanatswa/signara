export const BRAND_THEMES = {
  navy: {
    label: 'Signara Navy',
    hex: '#0F2C59',
    hsl: '216 71% 20%',
  },
  green: {
    label: 'Green',
    hex: '#046307',
    hsl: '122 92% 20%',
  },
  black: {
    label: 'Black',
    hex: '#000000',
    hsl: '0 0% 0%',
  },
  maroon: {
    label: 'Maroon',
    hex: '#800000',
    hsl: '0 100% 25%',
  },
} as const

export type BrandTheme = keyof typeof BRAND_THEMES

export const BRAND_THEME_IDS = Object.keys(BRAND_THEMES) as BrandTheme[]

export const DEFAULT_BRAND_THEME: BrandTheme = 'navy'

export function isBrandTheme(value: string): value is BrandTheme {
  return value in BRAND_THEMES
}

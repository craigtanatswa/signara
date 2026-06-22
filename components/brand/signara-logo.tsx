import Image from 'next/image'
import { cn } from '@/lib/utils'

const SIZES = {
  xs: { width: 74, height: 32, imgClass: 'h-8 max-w-full' },
  sm: { width: 240, height: 72, imgClass: 'h-16 max-w-full' },
  md: { width: 320, height: 96, imgClass: 'h-20 max-w-full' },
  lg: { width: 360, height: 108, imgClass: 'h-24 max-w-full' },
} as const

type SignaraLogoSize = keyof typeof SIZES

interface SignaraLogoProps {
  size?: SignaraLogoSize
  /** When true, renders only the image (parent should supply off-white background). */
  bare?: boolean
  className?: string
  containerClassName?: string
  priority?: boolean
}

export function SignaraLogo({
  size = 'md',
  bare = false,
  className,
  containerClassName,
  priority = false,
}: SignaraLogoProps) {
  const { width, height, imgClass } = SIZES[size]

  const image = (
    <Image
      src="/assets/logo-signara.png"
      alt="Signara"
      width={width}
      height={height}
      priority={priority}
      className={cn('w-auto object-contain', imgClass, className)}
    />
  )

  if (bare) {
    return image
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-signara-offwhite px-3 py-1.5',
        containerClassName
      )}
    >
      {image}
    </div>
  )
}

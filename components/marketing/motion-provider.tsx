'use client'

import { MotionConfig } from 'motion/react'

/**
 * `reducedMotion="user"` makes every marketing animation honour the OS setting:
 * transforms are skipped, opacity fades still run.
 */
export function MarketingMotionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  )
}

'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  /** Horizontal entry instead of the default upward drift. */
  from?: 'bottom' | 'left' | 'right'
}

const OFFSETS = {
  bottom: { x: 0, y: 26 },
  left: { x: -26, y: 0 },
  right: { x: 26, y: 0 },
} as const

export function Reveal({
  children,
  className,
  delay = 0,
  from = 'bottom',
}: RevealProps) {
  const offset = OFFSETS[from]

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.65, delay }}
    >
      {children}
    </motion.div>
  )
}

'use client'

import dynamic from 'next/dynamic'
import { useSyncExternalStore } from 'react'
import { HeroVisualFallback } from './hero-visual-fallback'

const HeroScene = dynamic(() => import('./hero-scene'), {
  ssr: false,
  loading: () => <HeroVisualFallback />,
})

/** WebGL is optional: anything that fails these checks keeps the static SVG. */
function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}

function isLowPowerDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2)
    return true
  return false
}

let capable: boolean | null = null

function isCapable() {
  if (capable === null) capable = !isLowPowerDevice() && supportsWebGL()
  return capable
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot() {
  return isCapable() && !window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function HeroVisual() {
  const showScene = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return showScene ? <HeroScene /> : <HeroVisualFallback />
}

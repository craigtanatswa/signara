/**
 * Continuous calligraphic "Signara" + underline flourish — one pen stroke.
 * An aesthetic, elegant signature fitting the brand name.
 * Artboard roughly 0–620 × 0–280.
 */
export const BRAND_SIGNATURE_PATH =
  // S
  'M 120 180 ' +
  'C 150 90, 200 40, 220 90 ' +
  'C 240 140, 160 200, 110 180 ' +
  'C 80 160, 100 130, 140 150 ' +
  'C 160 160, 180 180, 200 180 ' +
  // i
  'C 220 180, 240 130, 230 140 ' +
  'C 220 150, 220 180, 240 180 ' +
  // g
  'C 250 180, 270 150, 280 150 ' +
  'C 290 150, 280 180, 260 180 ' +
  'C 240 180, 240 150, 260 150 ' +
  'C 280 150, 280 200, 270 240 ' +
  'C 260 280, 220 280, 230 240 ' +
  'C 240 200, 290 150, 310 180 ' +
  // n
  'C 320 195, 320 150, 330 150 ' +
  'C 340 150, 330 180, 340 180 ' +
  'C 350 180, 350 150, 360 150 ' +
  'C 370 150, 360 180, 370 180 ' +
  // a
  'C 380 180, 400 150, 410 150 ' +
  'C 420 150, 410 180, 390 180 ' +
  'C 370 180, 370 150, 390 150 ' +
  'C 410 150, 410 180, 420 180 ' +
  // r
  'C 430 180, 440 150, 450 150 ' +
  'C 460 150, 460 160, 450 180 ' +
  // a
  'C 460 180, 480 150, 490 150 ' +
  'C 500 150, 490 180, 470 180 ' +
  'C 450 180, 450 150, 470 150 ' +
  'C 490 150, 490 180, 500 180 ' +
  // flourish
  'C 520 180, 530 160, 540 180 ' +
  'C 560 220, 200 240, 100 220 ' +
  'C 80 215, 80 230, 100 230 ' +
  'C 200 230, 450 220, 620 160'

export const BRAND_FLOURISH_DOT = { x: 233, y: 120, r: 4.5 }

/** Measure path length via an SVG path element (browser-only). */
export function measureSignaturePath(d: string) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  return path.getTotalLength()
}

/**
 * Draw "Signara" as one continuous motion using stroke-dash reveal —
 * the same technique as SVG pathLength animation.
 */
export function paintBrandSignature(
  ctx: CanvasRenderingContext2D,
  pathLength: number,
  progress: number,
  color: string,
  transform: { scale: number; offsetX: number; offsetY: number }
) {
  const t = Math.min(1, Math.max(0, progress))
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (t <= 0.001) return

  const { scale, offsetX, offsetY } = transform
  const path = new Path2D(BRAND_SIGNATURE_PATH)

  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 7.5 / scale

  const drawn = pathLength * t
  ctx.setLineDash([drawn, pathLength])
  ctx.lineDashOffset = 0
  ctx.stroke(path)

  if (t > 0.96) {
    const alpha = Math.min(1, (t - 0.96) / 0.04)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(BRAND_FLOURISH_DOT.x, BRAND_FLOURISH_DOT.y, BRAND_FLOURISH_DOT.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

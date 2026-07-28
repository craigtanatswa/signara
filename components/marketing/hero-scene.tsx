'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const SHEET_W = 1.5
const SHEET_H = 2
const NAVY = '#0F2C59'
const GOLD = '#D4AF37'
const STEEL = '#A1A8A2'

/** Scatter → order → sign → seal timeline, in seconds from the first frame. */
const SETTLE_DURATION = 1.5
const SETTLE_STAGGER = 0.13
const SIGN_START = 1.95
const SIGN_DURATION = 2
const SEAL_START = 3.85
const SEAL_DURATION = 0.75

interface Pose {
  position: [number, number, number]
  rotation: [number, number, number]
}

/** Loose sheets, and the ordered cascade they settle into. */
const SHEETS: { scattered: Pose; ordered: Pose }[] = [
  {
    scattered: { position: [1.7, -1.9, 1.1], rotation: [0.42, -0.95, 0.55] },
    ordered: { position: [0.3, -0.55, 0.75], rotation: [-0.12, -0.3, 0.03] },
  },
  {
    scattered: { position: [-1.9, -1.5, 0.4], rotation: [-0.5, 0.75, -0.62] },
    ordered: { position: [-0.15, -0.05, 0.25], rotation: [-0.12, -0.3, 0.02] },
  },
  {
    scattered: { position: [2.1, 1.7, -0.5], rotation: [0.58, 0.9, 0.7] },
    ordered: { position: [-0.6, 0.45, -0.25], rotation: [-0.12, -0.3, 0.01] },
  },
  {
    scattered: { position: [-2.3, 2.1, -1.1], rotation: [-0.45, -0.8, -0.5] },
    ordered: { position: [-1.05, 0.95, -0.75], rotation: [-0.12, -0.3, 0] },
  },
]

const TEXT_ROWS = [
  { y: 0.52, width: 1.06 },
  { y: 0.32, width: 0.84 },
  { y: 0.12, width: 1.02 },
  { y: -0.08, width: 0.7 },
  { y: -0.28, width: 0.92 },
]

const SIGNATURE_W = 1.15
const SIGNATURE_H = 0.32

/** Hand-drawn "J.Smith" on a transparent canvas — letterforms stay readable. */
function createSignatureTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 168
  const ctx = canvas.getContext('2d')!

  const paint = (progress: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width * Math.max(progress, 0.001), canvas.height)
    ctx.clip()

    // Slight rightward slant so it reads as a signature, not typed text.
    ctx.transform(1, 0, -0.18, 1, 28, 0)

    ctx.strokeStyle = GOLD
    ctx.fillStyle = GOLD
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 9

    // J
    ctx.beginPath()
    ctx.moveTo(24, 52)
    ctx.lineTo(96, 52)
    ctx.moveTo(72, 52)
    ctx.lineTo(72, 128)
    ctx.quadraticCurveTo(72, 152, 36, 148)
    ctx.stroke()

    // .
    ctx.beginPath()
    ctx.arc(118, 138, 6, 0, Math.PI * 2)
    ctx.fill()

    // S — start upper-right, left bowl, cross, right bowl (classic S, not a 2)
    ctx.beginPath()
    ctx.moveTo(210, 78)
    ctx.bezierCurveTo(190, 62, 150, 66, 142, 88)
    ctx.bezierCurveTo(136, 104, 156, 112, 178, 116)
    ctx.bezierCurveTo(210, 122, 222, 132, 216, 146)
    ctx.bezierCurveTo(208, 164, 164, 166, 146, 150)
    ctx.stroke()

    // m — three clear humps
    ctx.beginPath()
    ctx.moveTo(236, 150)
    ctx.lineTo(236, 98)
    ctx.bezierCurveTo(236, 78, 268, 78, 268, 98)
    ctx.lineTo(268, 150)
    ctx.moveTo(268, 98)
    ctx.bezierCurveTo(268, 78, 300, 78, 300, 98)
    ctx.lineTo(300, 150)
    ctx.moveTo(300, 98)
    ctx.bezierCurveTo(300, 78, 332, 78, 332, 98)
    ctx.lineTo(332, 150)
    ctx.stroke()

    // i
    ctx.beginPath()
    ctx.moveTo(354, 150)
    ctx.lineTo(354, 98)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(354, 76, 5.5, 0, Math.PI * 2)
    ctx.fill()

    // t
    ctx.beginPath()
    ctx.moveTo(384, 150)
    ctx.lineTo(384, 48)
    ctx.moveTo(360, 90)
    ctx.lineTo(410, 88)
    ctx.stroke()

    // h — open arch on the right
    ctx.beginPath()
    ctx.moveTo(432, 150)
    ctx.lineTo(432, 48)
    ctx.moveTo(432, 98)
    ctx.bezierCurveTo(452, 76, 488, 76, 500, 98)
    ctx.lineTo(500, 150)
    ctx.stroke()

    ctx.restore()
  }

  paint(0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true

  return { canvas, texture, paint }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
const easeOutBack = (t: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

function roundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape()
  const x = -width / 2
  const y = -height / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + height - radius)
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  shape.lineTo(x + radius, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  return shape
}

function Documents() {
  const { size } = useThree()

  const rig = useRef<THREE.Group>(null)
  const sheets = useRef<(THREE.Group | null)[]>([])
  const signatureMesh = useRef<THREE.Mesh>(null)
  const seal = useRef<THREE.Group>(null)
  const startedAt = useRef<number | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const lastPaint = useRef(-1)

  const assets = useMemo(() => {
    const sheet = new THREE.ExtrudeGeometry(
      roundedRectShape(SHEET_W, SHEET_H, 0.07),
      { depth: 0.014, bevelEnabled: false, curveSegments: 5 }
    )

    const { texture, paint } = createSignatureTexture()

    const tick = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.055, 0.004, 0),
        new THREE.Vector3(-0.012, -0.042, 0),
        new THREE.Vector3(0.062, 0.052, 0),
      ]),
      24,
      0.013,
      5,
      false
    )

    return {
      sheet,
      signaturePlane: new THREE.PlaneGeometry(SIGNATURE_W, SIGNATURE_H),
      signatureTexture: texture,
      paintSignature: paint,
      textRow: new THREE.PlaneGeometry(1, 0.048),
      header: new THREE.PlaneGeometry(SHEET_W - 0.26, 0.055),
      ring: new THREE.TorusGeometry(0.15, 0.017, 8, 44),
      tick,
    }
  }, [])

  const materials = useMemo(
    () => ({
      paper: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      navy: new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({
        color: STEEL,
        roughness: 0.9,
        transparent: true,
        opacity: 0.6,
      }),
      gold: new THREE.MeshStandardMaterial({
        color: GOLD,
        roughness: 0.28,
        metalness: 0.75,
        emissive: new THREE.Color(GOLD),
        emissiveIntensity: 0.12,
      }),
      signature: new THREE.MeshBasicMaterial({
        map: assets.signatureTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    }),
    [assets.signatureTexture]
  )

  useEffect(() => {
    return () => {
      assets.sheet.dispose()
      assets.signaturePlane.dispose()
      assets.signatureTexture.dispose()
      assets.textRow.dispose()
      assets.header.dispose()
      assets.ring.dispose()
      assets.tick.dispose()
      Object.values(materials).forEach((material) => material.dispose())
    }
  }, [assets, materials])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((state, delta) => {
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - startedAt.current

    SHEETS.forEach((spec, index) => {
      const group = sheets.current[index]
      if (!group) return

      const progress = easeOutCubic(
        clamp01((elapsed - index * SETTLE_STAGGER) / SETTLE_DURATION)
      )
      const drift = Math.sin(elapsed * 0.55 + index * 1.3) * 0.035 * progress

      group.position.set(
        THREE.MathUtils.lerp(spec.scattered.position[0], spec.ordered.position[0], progress),
        THREE.MathUtils.lerp(spec.scattered.position[1], spec.ordered.position[1], progress) + drift,
        THREE.MathUtils.lerp(spec.scattered.position[2], spec.ordered.position[2], progress)
      )
      group.rotation.set(
        THREE.MathUtils.lerp(spec.scattered.rotation[0], spec.ordered.rotation[0], progress),
        THREE.MathUtils.lerp(spec.scattered.rotation[1], spec.ordered.rotation[1], progress),
        THREE.MathUtils.lerp(spec.scattered.rotation[2], spec.ordered.rotation[2], progress) +
          drift * 0.25
      )
    })

    const stroke = easeInOutSine(clamp01((elapsed - SIGN_START) / SIGN_DURATION))
    const paintStep = Math.round(stroke * 40) / 40
    if (paintStep !== lastPaint.current) {
      lastPaint.current = paintStep
      assets.paintSignature(paintStep)
      assets.signatureTexture.needsUpdate = true
    }
    if (signatureMesh.current) {
      signatureMesh.current.visible = stroke > 0.01
    }

    if (seal.current) {
      const pop = clamp01((elapsed - SEAL_START) / SEAL_DURATION)
      seal.current.visible = pop > 0
      seal.current.scale.setScalar(Math.max(easeOutBack(pop), 0.0001))
    }

    if (rig.current) {
      rig.current.rotation.y = THREE.MathUtils.damp(
        rig.current.rotation.y,
        pointer.current.x * 0.16,
        3,
        delta
      )
      rig.current.rotation.x = THREE.MathUtils.damp(
        rig.current.rotation.x,
        pointer.current.y * 0.09,
        3,
        delta
      )
    }
  })

  const scale = THREE.MathUtils.clamp(size.width / 560, 0.6, 1)

  return (
    <group ref={rig}>
      <group scale={scale} position={[0.25, -0.2, 0]}>
        {SHEETS.map((_, index) => (
          <group
            key={index}
            ref={(node) => {
              sheets.current[index] = node
            }}
          >
            <mesh geometry={assets.sheet} material={materials.paper} />
            <mesh
              geometry={assets.header}
              material={materials.navy}
              position={[0, SHEET_H / 2 - 0.16, 0.016]}
            />
            {TEXT_ROWS.map((row) => (
              <mesh
                key={row.y}
                geometry={assets.textRow}
                material={materials.steel}
                position={[-(SHEET_W / 2 - 0.13) + row.width / 2, row.y, 0.016]}
                scale={[row.width, 1, 1]}
              />
            ))}
            <mesh
              geometry={assets.textRow}
              material={materials.steel}
              position={[0, -0.74, 0.016]}
              scale={[1.05, 0.4, 1]}
            />
            {index === 0 && (
              <mesh
                ref={signatureMesh}
                geometry={assets.signaturePlane}
                material={materials.signature}
                position={[0.05, -0.54, 0.028]}
                visible={false}
              />
            )}
          </group>
        ))}

        <group
          ref={seal}
          position={[1.18, -1, 1.15]}
          rotation={[0, -0.28, 0]}
          visible={false}
        >
          <mesh geometry={assets.ring} material={materials.gold} />
          <mesh geometry={assets.tick} material={materials.gold} />
        </group>
      </group>
    </group>
  )
}

export default function HeroScene() {
  const [inView, setInView] = useState(true)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = wrapper.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.02 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapper} className="h-full w-full">
      <Canvas
        flat
        dpr={[1, 1.75]}
        frameloop={inView ? 'always' : 'demand'}
        camera={{ position: [0, 0.15, 6.2], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="pointer-events-none"
      >
        <ambientLight intensity={2.1} />
        <directionalLight position={[3.5, 5, 6]} intensity={2.2} />
        <directionalLight position={[-4.5, 1.5, 3]} intensity={0.7} color={STEEL} />
        <Documents />
      </Canvas>
    </div>
  )
}

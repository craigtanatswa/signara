import { cn } from '@/lib/utils'

/**
 * Static brand visual used while the WebGL scene loads and as the permanent
 * substitute when WebGL is unavailable. Mirrors the 3D metaphor: loose sheets
 * settling into an ordered stack, signed in gold.
 */
export function HeroVisualFallback({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full w-full items-center justify-center', className)}>
      <svg
        viewBox="0 0 560 520"
        role="img"
        aria-label="Documents settling into an ordered stack and being signed"
        className="h-full w-full max-h-[520px] object-contain"
      >
        <defs>
          <linearGradient id="sheet-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#eef1f4" />
          </linearGradient>
        </defs>

        {[
          { x: 96, y: 40, r: -9, o: 0.4 },
          { x: 140, y: 96, r: -6, o: 0.65 },
          { x: 184, y: 152, r: -3, o: 1 },
        ].map((sheet, i) => (
          <g
            key={i}
            transform={`translate(${sheet.x} ${sheet.y}) rotate(${sheet.r} 110 145)`}
            opacity={sheet.o}
          >
            <rect
              width="220"
              height="290"
              rx="10"
              fill="url(#sheet-face)"
              stroke="#A1A8A2"
              strokeOpacity="0.45"
            />
            <rect width="220" height="10" rx="5" fill="#0F2C59" />
            {[0, 1, 2, 3, 4].map((line) => (
              <rect
                key={line}
                x="26"
                y={48 + line * 26}
                width={line % 2 === 0 ? 150 : 118}
                height="8"
                rx="4"
                fill="#0F2C59"
                fillOpacity="0.12"
              />
            ))}
          </g>
        ))}

        {/* Gold "J.Smith" signature — path letterforms match the 3D canvas stroke */}
        <g
          fill="none"
          stroke="#D4AF37"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-signature-wipe"
          style={{ clipPath: 'inset(0 100% 0 0)' }}
        >
          {/* J */}
          <path d="M186 368h44M216 368v58c0 14-18 18-28 10" />
          {/* . */}
          <circle cx="250" cy="434" r="4.5" fill="#D4AF37" stroke="none" />
          {/* S */}
          <path d="M310 392c-16-14-44-12-50 6c-4 14 12 20 28 22c24 4 34 12 28 26c-6 16-36 18-50 6" />
          {/* m */}
          <path d="M330 440v-36c0-16 24-16 24 0v36M354 404c0-16 24-16 24 0v36M378 404c0-16 24-16 24 0v36" />
          {/* i */}
          <path d="M416 440v-36" />
          <circle cx="416" cy="388" r="3.5" fill="#D4AF37" stroke="none" />
          {/* t */}
          <path d="M438 440v-68M420 398h36" />
          {/* h */}
          <path d="M470 440v-68M470 404c14-16 38-16 46 0v36" />
        </g>

        <g className="animate-seal-in" style={{ transformOrigin: '430px 424px' }}>
          <circle
            cx="430"
            cy="424"
            r="24"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="3"
          />
          <path
            d="M420 424l7 8 14-16"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  )
}

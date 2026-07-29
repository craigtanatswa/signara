import { cn } from '@/lib/utils'
import {
  BRAND_FLOURISH_DOT,
  BRAND_SIGNATURE_PATH,
} from './brand-signature'

/**
 * Static brand visual used while the WebGL scene loads and as the permanent
 * substitute when WebGL is unavailable. Mirrors the 3D metaphor: loose sheets
 * settling into an ordered stack, signed with a calligraphic "Eagan".
 */
export function HeroVisualFallback({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full w-full items-center justify-center', className)}>
      <svg
        viewBox="0 0 620 520"
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
          { x: 126, y: 40, r: -9, o: 0.4 },
          { x: 170, y: 96, r: -6, o: 0.65 },
          { x: 214, y: 152, r: -3, o: 1 },
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

        {/* Gold "Signara" — one continuous calligraphic stroke */}
        <g transform="translate(160 250) scale(0.35)">
          <path
            d={BRAND_SIGNATURE_PATH}
            fill="none"
            stroke="#D4AF37"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset="1"
            className="animate-draw-signature"
          />
          <circle
            cx={BRAND_FLOURISH_DOT.x}
            cy={BRAND_FLOURISH_DOT.y}
            r={BRAND_FLOURISH_DOT.r}
            fill="#D4AF37"
            className="animate-seal-in"
            style={{ animationDelay: '2.9s' }}
          />
        </g>

        <g className="animate-seal-in" style={{ transformOrigin: '460px 424px' }}>
          <circle
            cx="460"
            cy="424"
            r="24"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="3"
          />
          <path
            d="M450 424l7 8 14-16"
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

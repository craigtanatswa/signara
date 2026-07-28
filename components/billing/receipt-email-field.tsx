'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ReceiptEmailFieldProps {
  value: string
  onChange: (email: string) => void
  history: string[]
}

export function ReceiptEmailField({ value, onChange, history }: ReceiptEmailFieldProps) {
  return (
    <div className="space-y-3 rounded-lg border border-signara-steel/30 bg-signara-background/50 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="receipt-email" className="text-signara-navy font-medium">
          Receipt will be sent to:
        </Label>
        <Input
          id="receipt-email"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-signara-steel focus-visible:ring-signara-navy"
          placeholder="you@company.com"
        />
        <p className="text-xs text-signara-steel">
          You can change this address. We&apos;ll remember it for next time.
        </p>
      </div>

      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-signara-steel">
            Previous receipt emails
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((email) => {
              const selected = email.toLowerCase() === value.trim().toLowerCase()
              return (
                <button
                  key={email}
                  type="button"
                  onClick={() => onChange(email)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    selected
                      ? 'border-signara-gold bg-signara-gold/15 font-semibold text-signara-navy'
                      : 'border-signara-steel/40 bg-white text-signara-navy hover:border-signara-navy/40'
                  }`}
                >
                  {email}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

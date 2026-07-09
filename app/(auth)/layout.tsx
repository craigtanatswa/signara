import Image from 'next/image'
import { AuthPromoRotator } from '@/components/auth/auth-promo-rotator'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      {/* Left panel — rotating promo copy */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-signara-navy p-12">
        <AuthPromoRotator className="flex flex-1 flex-col justify-center" />

        <p className="text-sm text-white/40">
          &copy; {new Date().getFullYear()} Signara. All rights reserved.
        </p>
      </div>

      {/* Right panel — logo + form */}
      <div className="flex w-full lg:w-1/2 flex-col bg-white p-8">
        <div className="mb-8 flex justify-center">
          <Image
            src="/assets/logo-signara.png"
            alt="Signara"
            width={369}
            height={160}
            priority
            className="h-20 w-auto max-w-[85%] object-contain lg:h-24"
          />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-md">
            <p className="mb-8 text-center text-sm leading-relaxed text-signara-steel lg:hidden">
              Secure digital document workflows for modern organisations.
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

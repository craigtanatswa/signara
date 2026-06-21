import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-signara-navy p-12">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo-signara.png"
            alt="Signara"
            width={160}
            height={48}
            priority
            className="h-12 w-auto"
          />
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-4">
            <p className="text-3xl font-bold leading-tight text-white">
              Document workflows for modern organisations
            </p>
            <p className="text-signara-steel text-lg">
              Replace paper-based approval processes with secure, auditable
              digital workflows. Built for Zimbabwe and the SADC region.
            </p>
          </blockquote>

          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-signara-gold text-2xl font-bold">100%</p>
              <p className="text-white/70 text-sm">Digital</p>
            </div>
            <div>
              <p className="text-signara-gold text-2xl font-bold">Multi</p>
              <p className="text-white/70 text-sm">Signatory</p>
            </div>
            <div>
              <p className="text-signara-gold text-2xl font-bold">SADC</p>
              <p className="text-white/70 text-sm">Ready</p>
            </div>
          </div>
        </div>

        <p className="text-white/40 text-sm">
          &copy; {new Date().getFullYear()} Signara. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Image
              src="/assets/logo-signara.png"
              alt="Signara"
              width={140}
              height={42}
              priority
              className="h-10 w-auto"
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

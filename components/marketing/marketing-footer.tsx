import Image from 'next/image'
import Link from 'next/link'

const PRODUCT_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#who-its-for', label: "Who it's for" },
  { href: '#cost', label: 'Cost comparison' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Questions' },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-signara-steel/25 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div>
          <Image
            src="/assets/logo-signara.png"
            alt="Signara"
            width={369}
            height={160}
            className="h-12 w-auto object-contain"
          />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-signara-navy/70">
            Secure document templates, approval workflows and signatures for
            organisations in Zimbabwe and the wider SADC region.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-signara-navy">Product</p>
          <ul className="mt-4 space-y-3">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-signara-navy/70 transition-colors hover:text-signara-navy"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-signara-navy">Get started</p>
          <ul className="mt-4 space-y-3">
            <li>
              <Link
                href="/register"
                className="text-sm font-medium text-signara-gold hover:underline"
              >
                Start your free trial
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="text-sm text-signara-navy/70 transition-colors hover:text-signara-navy"
              >
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-signara-steel/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-signara-navy/70 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>&copy; {new Date().getFullYear()} Signara. All rights reserved.</p>
          <p>Prices shown in USD, billed monthly.</p>
        </div>
      </div>
    </footer>
  )
}

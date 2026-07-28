'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#who-its-for', label: "Who it's for" },
  { href: '#cost', label: 'Cost comparison' },
  { href: '#pricing', label: 'Pricing' },
]

export function MarketingHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled || menuOpen
          ? 'border-signara-steel/25 bg-white/90 backdrop-blur-md'
          : 'border-transparent bg-signara-background/60 backdrop-blur-sm'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3 sm:px-8">
        <Link href="/" aria-label="Signara home" className="shrink-0">
          <Image
            src="/assets/logo-signara.png"
            alt="Signara"
            width={369}
            height={160}
            priority
            className="h-10 w-auto object-contain sm:h-12"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-signara-navy/75 transition-colors hover:text-signara-navy"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:ml-0 lg:flex">
          {isAuthenticated ? (
            <Button asChild variant="signara" size="lg">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="text-signara-navy hover:bg-signara-navy/5"
              >
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="signara" size="lg">
                <Link href="/register">Start free trial</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="marketing-mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="ml-auto inline-flex size-10 items-center justify-center rounded-md text-signara-navy transition-colors hover:bg-signara-navy/5 lg:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div
          id="marketing-mobile-nav"
          className="border-t border-signara-steel/20 bg-white px-5 pb-6 pt-4 lg:hidden"
        >
          <nav className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-signara-steel/15 py-3 text-base font-medium text-signara-navy"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-5 flex flex-col gap-3">
            {isAuthenticated ? (
              <Button asChild variant="signara" size="lg">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="signara" size="lg">
                  <Link href="/register">Start free trial</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-2 border-signara-navy bg-transparent font-semibold text-signara-navy shadow-none hover:bg-signara-navy hover:text-white dark:border-signara-navy dark:bg-transparent dark:hover:bg-signara-navy"
                >
                  <Link href="/login">Log in</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  )
}

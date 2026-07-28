import { AppViewport } from '@/components/layout/app-viewport'

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppViewport>{children}</AppViewport>
}

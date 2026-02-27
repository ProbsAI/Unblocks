import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/serverAuth'
import { requireAdmin } from '@unblocks/core/admin'
import Link from 'next/link'

const adminNav = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  try {
    await requireAdmin(user.id)
  } catch {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-lg font-bold text-foreground"
            >
              Admin
            </Link>
            <nav className="flex gap-4">
              {adminNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}

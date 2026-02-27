'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '\u{1F3E0}' },
  { href: '/teams', label: 'Teams', icon: '\u{1F465}' },
  { href: '/dashboard/billing', label: 'Billing', icon: '\u{1F4B3}' },
  { href: '/notifications', label: 'Notifications', icon: '\u{1F514}' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-white md:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="text-lg font-bold text-foreground">
          MyApp
        </Link>
      </div>
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { NotificationBell } from './NotificationBell'
import type { User } from '@unblocks/core/auth/types'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <h2 className="text-sm font-medium text-muted-foreground">
        Welcome back{user.name ? `, ${user.name}` : ''}
      </h2>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </header>
  )
}

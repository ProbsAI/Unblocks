'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface NotificationItem {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  actionUrl: string | null
  createdAt: string
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()

    // SSE for real-time updates
    const eventSource = new EventSource('/api/notifications/stream')
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'notification') {
        setNotifications((prev) => [data.notification, ...prev].slice(0, 10))
        setUnreadCount((prev) => prev + 1)
      }
    }

    return () => eventSource.close()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=10')
      const data = await res.json()
      if (data.data) {
        setNotifications(data.data.notifications)
        setUnreadCount(data.data.unreadCount)
      }
    } catch {
      // Silent fail
    }
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markAllRead' }),
    })
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 ? (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No notifications
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-border px-4 py-3 last:border-0 ${
                    n.read ? '' : 'bg-primary/5'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {n.body}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-2">
            <Link
              href="/notifications"
              className="block rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

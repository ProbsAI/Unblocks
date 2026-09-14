'use client'

import { useState, useRef, useEffect, useId } from 'react'

interface DropdownItem {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
}

export function Dropdown({ trigger, items }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Escape closes, matching every other menu a user has met.
  useEffect(() => {
    if (!open) return

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      {/*
        A real button, not a div with onClick. A div is not focusable, does not
        respond to Enter or Space, and reports no state — so the menu was
        simply unreachable without a mouse. `trigger` is arbitrary content, so
        it is wrapped rather than required to be a button itself.
      */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => { item.onClick(); setOpen(false) }}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-muted ${
                item.variant === 'danger' ? 'text-red-600' : 'text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

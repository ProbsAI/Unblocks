'use client'

import { useState, useRef, useEffect } from 'react'

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-md border border-border bg-white py-1 shadow-lg">
          {items.map((item, i) => (
            <button
              key={i}
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

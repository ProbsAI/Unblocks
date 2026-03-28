'use client'

import { useState } from 'react'

interface CopyButtonProps {
  value: string
  label?: string
}

export function CopyButton({ value, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

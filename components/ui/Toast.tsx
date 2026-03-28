'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

const typeStyles = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${typeStyles[type]}`}
    >
      {message}
    </div>
  )
}

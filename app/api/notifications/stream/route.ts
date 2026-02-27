import { requireAuth } from '@/lib/serverAuth'
import { subscribeToStream } from '@unblocks/core/notifications'

/**
 * SSE endpoint for real-time notifications.
 * Clients connect via EventSource and receive notifications as they arrive.
 */
export async function GET(): Promise<Response> {
  const user = await requireAuth()

  const encoder = new TextEncoder()

  // Closure-scoped cleanup handles shared by start() and cancel()
  let unsubscribe: (() => void) | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial ping
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // Subscribe to notification stream
      unsubscribe = subscribeToStream(user.id, (notification) => {
        try {
          const data = JSON.stringify({ type: 'notification', notification })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // Stream closed
        }
      })

      // Keep-alive ping every 30 seconds
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`))
        } catch {
          if (pingInterval) clearInterval(pingInterval)
        }
      }, 30_000)
    },

    cancel() {
      // Called when the client disconnects
      if (unsubscribe) unsubscribe()
      if (pingInterval) clearInterval(pingInterval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

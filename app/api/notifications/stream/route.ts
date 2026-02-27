import { requireAuth } from '@/lib/serverAuth'
import { subscribeToStream } from '@unblocks/core/notifications'

/**
 * SSE endpoint for real-time notifications.
 * Clients connect via EventSource and receive notifications as they arrive.
 */
export async function GET(): Promise<Response> {
  const user = await requireAuth()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial ping
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // Subscribe to notification stream
      const unsubscribe = subscribeToStream(user.id, (notification) => {
        try {
          const data = JSON.stringify({ type: 'notification', notification })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // Stream closed
        }
      })

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`))
        } catch {
          clearInterval(pingInterval)
        }
      }, 30_000)

      // Cleanup on close
      const cleanup = () => {
        unsubscribe()
        clearInterval(pingInterval)
      }

      // Set cleanup for when the stream is cancelled
      void stream.cancel?.().then(cleanup).catch(cleanup)
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

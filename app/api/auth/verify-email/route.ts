import { verifyEmail } from '@unblocks/core/auth'
import { withErrorHandler } from '@/lib/routeHandler'

export const GET = withErrorHandler(async (request) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login?error=invalid_token' },
    })
  }

  try {
    await verifyEmail(token)
    return new Response(null, {
      status: 302,
      headers: { Location: '/dashboard?verified=true' },
    })
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login?error=invalid_token' },
    })
  }
})

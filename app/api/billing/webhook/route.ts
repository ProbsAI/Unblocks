import { handleStripeWebhook } from '@unblocks/core/billing'

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return Response.json(
      { error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe signature' } },
      { status: 400 }
    )
  }

  try {
    await handleStripeWebhook(payload, signature)
    return Response.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return Response.json(
      { error: { code: 'WEBHOOK_ERROR', message: 'Webhook processing failed' } },
      { status: 400 }
    )
  }
}

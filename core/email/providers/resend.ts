import { Resend } from 'resend'
import type { SendEmailInput } from '../types'
import { loadConfig } from '../../runtime/configLoader'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const config = loadConfig('email')
    const apiKey = config.resend.apiKey || process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is required (set via config or env)')
    _resend = new Resend(apiKey)
  }
  return _resend
}

export async function sendViaResend(input: SendEmailInput): Promise<void> {
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: input.from
      ? `${input.from.name} <${input.from.email}>`
      : 'MyApp <no-reply@example.com>',
    to: input.to,
    subject: input.subject,
    html: input.html,
    headers: input.headers,
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

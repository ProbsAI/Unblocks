import { loadConfig } from '../runtime/configLoader'
import { runBeforeHook } from '../runtime/hookRunner'
import { sendViaResend } from './providers/resend'
import type { SendEmailInput, EmailHookArgs } from './types'

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const config = loadConfig('email')

  const from = input.from ?? config.from.transactional

  let hookArgs: EmailHookArgs = {
    to: input.to,
    from,
    subject: input.subject,
    html: input.html,
    headers: {},
  }

  // Run beforeEmailSend hook
  hookArgs = await runBeforeHook('beforeEmailSend', hookArgs)

  const emailInput: SendEmailInput = {
    to: hookArgs.to,
    from: hookArgs.from,
    subject: hookArgs.subject,
    html: hookArgs.html,
  }

  switch (config.provider) {
    case 'resend':
      await sendViaResend(emailInput)
      break
    default:
      console.warn(`Email provider "${config.provider}" not implemented, logging instead`)
      console.log('Email:', { to: emailInput.to, subject: emailInput.subject })
  }
}

import { z } from 'zod'

export const EmailConfigSchema = z.object({
  provider: z.enum(['resend', 'smtp']).default('resend'),

  resend: z.object({
    apiKey: z.string().default(''),
  }).default({}),

  from: z.object({
    default: z.object({
      name: z.string().default('MyApp'),
      email: z.string().email().default('hello@example.com'),
    }).default({}),
    transactional: z.object({
      name: z.string().default('MyApp'),
      email: z.string().email().default('no-reply@example.com'),
    }).default({}),
  }).default({}),

  queue: z.object({
    enabled: z.boolean().default(false),
    retryAttempts: z.number().default(3),
    retryDelay: z.string().default('5m'),
  }).default({}),

  templates: z.object({
    useCustom: z.boolean().default(false),
  }).default({}),
})

export type EmailConfig = z.infer<typeof EmailConfigSchema>

export interface EmailHookArgs {
  to: string
  from: { name: string; email: string }
  subject: string
  html: string
  headers?: Record<string, string>
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  from?: { name: string; email: string }
  headers?: Record<string, string>
}

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    provider: 'resend',
    from: {
      default: { name: 'MyApp', email: 'hello@example.com' },
      transactional: { name: 'MyApp', email: 'no-reply@example.com' },
    },
  }),
}))
vi.mock('../runtime/hookRunner', () => ({
  runBeforeHook: vi.fn((_name: string, args: unknown) => args),
}))
vi.mock('./providers/resend', () => ({
  sendViaResend: vi.fn(),
}))

import { sendEmail } from './sendEmail'
import { loadConfig } from '../runtime/configLoader'
import { runBeforeHook } from '../runtime/hookRunner'
import { sendViaResend } from './providers/resend'

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(loadConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: 'resend',
      from: {
        default: { name: 'MyApp', email: 'hello@example.com' },
        transactional: { name: 'MyApp', email: 'no-reply@example.com' },
      },
    })
    ;(runBeforeHook as ReturnType<typeof vi.fn>).mockImplementation(
      (_name: string, args: unknown) => args
    )
  })

  it('loads email config', async () => {
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(loadConfig).toHaveBeenCalledWith('email')
  })

  it('sends via resend provider when configured', async () => {
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    })

    expect(sendViaResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      })
    )
  })

  it('uses config transactional from address when no from is provided', async () => {
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(runBeforeHook).toHaveBeenCalledWith(
      'beforeEmailSend',
      expect.objectContaining({
        from: { name: 'MyApp', email: 'no-reply@example.com' },
      })
    )
  })

  it('uses custom from address when provided', async () => {
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      from: { name: 'Custom', email: 'custom@example.com' },
    })

    expect(runBeforeHook).toHaveBeenCalledWith(
      'beforeEmailSend',
      expect.objectContaining({
        from: { name: 'Custom', email: 'custom@example.com' },
      })
    )
  })

  it('runs beforeEmailSend hook before sending', async () => {
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(runBeforeHook).toHaveBeenCalledWith(
      'beforeEmailSend',
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test',
        headers: {},
      })
    )
  })

  it('allows hook to modify email before sending', async () => {
    ;(runBeforeHook as ReturnType<typeof vi.fn>).mockImplementation(
      (_name: string, args: Record<string, unknown>) => ({
        ...args,
        subject: 'Modified Subject',
        headers: { 'X-Custom': 'value' },
      })
    )

    await sendEmail({
      to: 'user@example.com',
      subject: 'Original Subject',
      html: '<p>Hello</p>',
    })

    expect(sendViaResend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Modified Subject',
        headers: { 'X-Custom': 'value' },
      })
    )
  })

  it('passes hook-modified recipient to provider', async () => {
    ;(runBeforeHook as ReturnType<typeof vi.fn>).mockImplementation(
      (_name: string, args: Record<string, unknown>) => ({
        ...args,
        to: 'redirected@example.com',
      })
    )

    await sendEmail({
      to: 'original@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(sendViaResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'redirected@example.com',
      })
    )
  })

  it('logs to console when provider is not implemented', async () => {
    ;(loadConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: 'unknown-provider',
      from: {
        transactional: { name: 'MyApp', email: 'no-reply@example.com' },
      },
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(sendViaResend).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not implemented')
    )
    expect(logSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
    logSpy.mockRestore()
  })
})

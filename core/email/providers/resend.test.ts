import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

vi.mock('../../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    resend: { apiKey: 'test-api-key' },
  }),
}))

import { sendViaResend } from './resend'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendViaResend', () => {
  it('sends email via Resend API', async () => {
    mockSend.mockResolvedValue({ error: null })

    await sendViaResend({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      from: { name: 'App', email: 'no-reply@app.com' },
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        from: 'App <no-reply@app.com>',
      })
    )
  })

  it('throws on Resend API error', async () => {
    mockSend.mockResolvedValue({ error: { message: 'Invalid API key' } })

    await expect(
      sendViaResend({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      })
    ).rejects.toThrow('Failed to send email: Invalid API key')
  })

  it('uses default from when not provided', async () => {
    mockSend.mockResolvedValue({ error: null })

    await sendViaResend({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'MyApp <no-reply@example.com>',
      })
    )
  })
})

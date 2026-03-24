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
  it('calls Resend emails.send with correct parameters', async () => {
    mockSend.mockResolvedValue({ error: null })

    await sendViaResend({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      from: { name: 'App', email: 'no-reply@app.com' },
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'App <no-reply@app.com>',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      })
    )
  })

  it('passes headers when provided', async () => {
    mockSend.mockResolvedValue({ error: null })

    await sendViaResend({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      from: { name: 'App', email: 'no-reply@app.com' },
      headers: { 'X-Custom': 'value' },
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Custom': 'value' },
      })
    )
  })

  it('uses default from address when from is not provided', async () => {
    mockSend.mockResolvedValue({ error: null })

    await sendViaResend({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'MyApp <no-reply@example.com>',
      })
    )
  })

  it('throws error when Resend returns an error', async () => {
    mockSend.mockResolvedValue({
      error: { message: 'Invalid API key' },
    })

    await expect(
      sendViaResend({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        from: { name: 'App', email: 'no-reply@app.com' },
      })
    ).rejects.toThrow('Failed to send email: Invalid API key')
  })

  it('does not throw when send succeeds with null error', async () => {
    mockSend.mockResolvedValue({ error: null })

    await expect(
      sendViaResend({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        from: { name: 'App', email: 'no-reply@app.com' },
      })
    ).resolves.toBeUndefined()
  })

  it('formats from address as "Name <email>"', async () => {
    mockSend.mockResolvedValue({ error: null })

    await sendViaResend({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      from: { name: 'My Company', email: 'info@company.com' },
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'My Company <info@company.com>',
      })
    )
  })
})

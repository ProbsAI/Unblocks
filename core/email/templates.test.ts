import { describe, it, expect } from 'vitest'
import {
  welcomeEmail,
  resetPasswordEmail,
  magicLinkEmail,
  verifyEmailTemplate,
  paymentSuccessEmail,
} from './templates'

describe('welcomeEmail', () => {
  it('returns subject and html with user name', () => {
    const result = welcomeEmail({ userName: 'Alice', loginUrl: 'https://app.com/login' })

    expect(result.subject).toContain('Welcome')
    expect(result.html).toContain('Alice')
    expect(result.html).toContain('https://app.com/login')
  })

  it('uses appName in subject', () => {
    const result = welcomeEmail({ userName: 'Bob', loginUrl: '/login', appName: 'TestApp' })

    expect(result.subject).toContain('TestApp')
    expect(result.html).toContain('TestApp')
  })

  it('handles empty userName gracefully', () => {
    const result = welcomeEmail({ userName: '', loginUrl: '/login' })

    expect(result.subject).toBeDefined()
    expect(result.html).toContain('there')
  })
})

describe('resetPasswordEmail', () => {
  it('returns subject and html with reset URL', () => {
    const result = resetPasswordEmail({ userName: 'Charlie', resetUrl: 'https://app.com/reset?token=abc' })

    expect(result.subject).toContain('Reset')
    expect(result.html).toContain('Charlie')
    expect(result.html).toContain('https://app.com/reset?token=abc')
  })

  it('mentions expiry time', () => {
    const result = resetPasswordEmail({ userName: 'Charlie', resetUrl: '/reset' })

    expect(result.html).toContain('1 hour')
  })
})

describe('magicLinkEmail', () => {
  it('returns subject and html with login URL', () => {
    const result = magicLinkEmail({ loginUrl: 'https://app.com/magic?token=xyz' })

    expect(result.subject).toContain('Sign in')
    expect(result.html).toContain('https://app.com/magic?token=xyz')
  })

  it('mentions expiry time', () => {
    const result = magicLinkEmail({ loginUrl: '/magic' })

    expect(result.html).toContain('15 minutes')
  })
})

describe('verifyEmailTemplate', () => {
  it('returns subject and html with verify URL', () => {
    const result = verifyEmailTemplate({ userName: 'Diana', verifyUrl: 'https://app.com/verify?token=123' })

    expect(result.subject).toContain('Verify')
    expect(result.html).toContain('Diana')
    expect(result.html).toContain('https://app.com/verify?token=123')
  })

  it('mentions 24 hour expiry', () => {
    const result = verifyEmailTemplate({ userName: 'Diana', verifyUrl: '/verify' })

    expect(result.html).toContain('24 hours')
  })
})

describe('paymentSuccessEmail', () => {
  it('returns subject and html with payment details', () => {
    const result = paymentSuccessEmail({
      userName: 'Eve',
      amount: 29.99,
      plan: 'Pro',
      invoiceUrl: 'https://stripe.com/invoice/123',
    })

    expect(result.subject).toContain('Payment')
    expect(result.html).toContain('Eve')
    expect(result.html).toContain('$29.99')
    expect(result.html).toContain('Pro')
    expect(result.html).toContain('https://stripe.com/invoice/123')
  })

  it('handles null invoiceUrl', () => {
    const result = paymentSuccessEmail({
      userName: 'Frank',
      amount: 10,
      plan: 'Basic',
      invoiceUrl: null,
    })

    expect(result.html).toContain('$10.00')
    expect(result.html).not.toContain('View Invoice')
  })

  it('formats amount to two decimal places', () => {
    const result = paymentSuccessEmail({
      userName: 'Grace',
      amount: 100,
      plan: 'Enterprise',
      invoiceUrl: null,
    })

    expect(result.html).toContain('$100.00')
  })
})

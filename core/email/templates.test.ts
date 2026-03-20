import { describe, it, expect } from 'vitest'
import {
  welcomeEmail,
  resetPasswordEmail,
  magicLinkEmail,
  verifyEmailTemplate,
  paymentSuccessEmail,
} from './templates'

describe('welcomeEmail', () => {
  it('returns subject and html with user name and login URL', () => {
    const result = welcomeEmail({
      userName: 'Alice',
      loginUrl: 'https://app.com/dashboard',
    })

    expect(result.subject).toBe('Welcome to MyApp!')
    expect(result.html).toContain('Welcome, Alice!')
    expect(result.html).toContain('https://app.com/dashboard')
    expect(result.html).toContain('Go to Dashboard')
  })

  it('uses custom appName in subject and body', () => {
    const result = welcomeEmail({
      userName: 'Bob',
      loginUrl: '/login',
      appName: 'TestApp',
    })

    expect(result.subject).toBe('Welcome to TestApp!')
    expect(result.html).toContain('TestApp')
  })

  it('falls back to "there" when userName is empty', () => {
    const result = welcomeEmail({ userName: '', loginUrl: '/login' })

    expect(result.html).toContain('Welcome, there!')
  })

  it('includes a valid HTML document structure', () => {
    const result = welcomeEmail({ userName: 'Test', loginUrl: '/login' })

    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('</html>')
  })
})

describe('resetPasswordEmail', () => {
  it('returns subject and html with reset URL', () => {
    const result = resetPasswordEmail({
      userName: 'Charlie',
      resetUrl: 'https://app.com/reset?token=abc',
    })

    expect(result.subject).toBe('Reset your MyApp password')
    expect(result.html).toContain('Reset Your Password')
    expect(result.html).toContain('Charlie')
    expect(result.html).toContain('https://app.com/reset?token=abc')
    expect(result.html).toContain('Reset Password')
  })

  it('mentions 1 hour expiry', () => {
    const result = resetPasswordEmail({
      userName: 'Charlie',
      resetUrl: '/reset',
    })

    expect(result.html).toContain('expires in 1 hour')
  })

  it('uses custom appName', () => {
    const result = resetPasswordEmail({
      userName: 'Alice',
      resetUrl: '/reset',
      appName: 'Acme',
    })

    expect(result.subject).toBe('Reset your Acme password')
  })
})

describe('magicLinkEmail', () => {
  it('returns subject and html with login URL', () => {
    const result = magicLinkEmail({
      loginUrl: 'https://app.com/magic?token=xyz',
    })

    expect(result.subject).toBe('Sign in to MyApp')
    expect(result.html).toContain('Sign In')
    expect(result.html).toContain('https://app.com/magic?token=xyz')
  })

  it('mentions 15 minutes expiry', () => {
    const result = magicLinkEmail({ loginUrl: '/magic' })

    expect(result.html).toContain('expires in 15 minutes')
  })

  it('uses custom appName', () => {
    const result = magicLinkEmail({
      loginUrl: '/magic',
      appName: 'Acme',
    })

    expect(result.subject).toBe('Sign in to Acme')
  })
})

describe('verifyEmailTemplate', () => {
  it('returns subject and html with verify URL', () => {
    const result = verifyEmailTemplate({
      userName: 'Diana',
      verifyUrl: 'https://app.com/verify?token=123',
    })

    expect(result.subject).toBe('Verify your email for MyApp')
    expect(result.html).toContain('Verify Your Email')
    expect(result.html).toContain('Diana')
    expect(result.html).toContain('https://app.com/verify?token=123')
    expect(result.html).toContain('Verify Email')
  })

  it('mentions 24 hour expiry', () => {
    const result = verifyEmailTemplate({
      userName: 'Diana',
      verifyUrl: '/verify',
    })

    expect(result.html).toContain('expires in 24 hours')
  })

  it('uses custom appName', () => {
    const result = verifyEmailTemplate({
      userName: 'Alice',
      verifyUrl: '/verify',
      appName: 'Acme',
    })

    expect(result.subject).toBe('Verify your email for Acme')
  })

  it('falls back to "there" when userName is empty', () => {
    const result = verifyEmailTemplate({
      userName: '',
      verifyUrl: '/verify',
    })

    expect(result.html).toContain('there')
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

    expect(result.subject).toContain('Payment received')
    expect(result.html).toContain('Payment Received')
    expect(result.html).toContain('Eve')
    expect(result.html).toContain('$29.99')
    expect(result.html).toContain('Pro')
    expect(result.html).toContain('View Invoice')
    expect(result.html).toContain('https://stripe.com/invoice/123')
  })

  it('omits invoice button when invoiceUrl is null', () => {
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

  it('uses custom appName in subject', () => {
    const result = paymentSuccessEmail({
      userName: 'Alice',
      amount: 10,
      plan: 'Basic',
      invoiceUrl: null,
      appName: 'Acme',
    })

    expect(result.subject).toContain('Acme')
  })

  it('shows plan name in bold', () => {
    const result = paymentSuccessEmail({
      userName: 'Test',
      amount: 50,
      plan: 'Premium',
      invoiceUrl: null,
    })

    expect(result.html).toContain('<strong>Premium</strong>')
  })
})

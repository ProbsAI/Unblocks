import { describe, it, expect } from 'vitest'
import {
  createEmailMock,
  createStripeMock,
  createHookSpy,
  createConfigMock,
} from './mocks'

describe('createEmailMock', () => {
  it('sendEmail records sent emails', async () => {
    const email = createEmailMock()

    const result = await email.sendEmail('user@test.com', 'Hello', '<p>Hi</p>')

    expect(result.id).toBeDefined()
    expect(email.getSentEmails()).toHaveLength(1)
    expect(email.getSentEmails()[0]).toEqual({
      to: 'user@test.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    })
  })

  it('getSentEmails returns copies', async () => {
    const email = createEmailMock()
    await email.sendEmail('a@test.com', 'Sub', '<p>body</p>')

    const list1 = email.getSentEmails()
    const list2 = email.getSentEmails()

    expect(list1).toEqual(list2)
    expect(list1).not.toBe(list2)
  })

  it('clear resets sent emails', async () => {
    const email = createEmailMock()
    await email.sendEmail('a@test.com', 'Sub', '<p>body</p>')

    email.clear()

    expect(email.getSentEmails()).toHaveLength(0)
  })

  it('failNext causes the next send to throw', async () => {
    const email = createEmailMock()
    email.failNext('Delivery failed')

    await expect(email.sendEmail('a@test.com', 'Sub', '<p>body</p>')).rejects.toThrow('Delivery failed')

    // Subsequent sends should work
    const result = await email.sendEmail('b@test.com', 'Sub2', '<p>ok</p>')
    expect(result.id).toBeDefined()
  })
})

describe('createStripeMock', () => {
  it('createCheckoutSession records sessions', async () => {
    const stripe = createStripeMock()

    const session = await stripe.createCheckoutSession({ priceId: 'price_123' })

    expect(session.id).toBeDefined()
    expect(session.url).toBeDefined()
    expect(stripe.getCheckoutSessions()).toHaveLength(1)
    expect(stripe.getCheckoutSessions()[0]).toHaveProperty('priceId', 'price_123')
  })

  it('clear resets sessions', async () => {
    const stripe = createStripeMock()
    await stripe.createCheckoutSession({ priceId: 'price_1' })

    stripe.clear()

    expect(stripe.getCheckoutSessions()).toHaveLength(0)
  })
})

describe('createHookSpy', () => {
  it('records calls', () => {
    const spy = createHookSpy()

    spy.calls.push({ name: 'onUserCreated', args: { userId: '1' } })

    expect(spy.calls).toHaveLength(1)
  })

  it('wasCalled returns true for recorded hook', () => {
    const spy = createHookSpy()
    spy.calls.push({ name: 'onUserCreated', args: { userId: '1' } })

    expect(spy.wasCalled('onUserCreated')).toBe(true)
    expect(spy.wasCalled('onPaymentSucceeded')).toBe(false)
  })

  it('getCallsFor returns args for specific hook', () => {
    const spy = createHookSpy()
    spy.calls.push({ name: 'onUserCreated', args: { userId: '1' } })
    spy.calls.push({ name: 'onUserCreated', args: { userId: '2' } })
    spy.calls.push({ name: 'onPaymentSucceeded', args: { amount: 100 } })

    const userCalls = spy.getCallsFor('onUserCreated')
    expect(userCalls).toHaveLength(2)
    expect(userCalls[0]).toEqual({ userId: '1' })
    expect(userCalls[1]).toEqual({ userId: '2' })
  })

  it('clear resets all calls', () => {
    const spy = createHookSpy()
    spy.calls.push({ name: 'onUserCreated', args: { userId: '1' } })

    spy.clear()

    expect(spy.calls).toHaveLength(0)
    expect(spy.wasCalled('onUserCreated')).toBe(false)
  })
})

describe('createConfigMock', () => {
  it('returns config for known keys', () => {
    const getConfig = createConfigMock()

    const authConfig = getConfig('auth')
    expect(authConfig).toBeDefined()
    expect(authConfig).toHaveProperty('providers')

    const billingConfig = getConfig('billing')
    expect(billingConfig).toBeDefined()
    expect(billingConfig).toHaveProperty('currency', 'usd')
  })

  it('throws for unknown keys', () => {
    const getConfig = createConfigMock()

    expect(() => getConfig('nonexistent')).toThrow('Unknown config key: nonexistent')
  })

  it('uses overrides', () => {
    const getConfig = createConfigMock({
      auth: { providers: { email: false, google: true, magicLink: false }, custom: true },
    })

    const authConfig = getConfig('auth')
    expect(authConfig).toHaveProperty('custom', true)
    expect((authConfig.providers as Record<string, boolean>).google).toBe(true)
  })
})

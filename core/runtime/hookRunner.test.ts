import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerHook,
  runHook,
  runBeforeHook,
  clearHooks,
  getRegisteredHooks,
} from './hookRunner'

beforeEach(() => {
  clearHooks()
})

describe('registerHook', () => {
  it('adds a handler to the registry', () => {
    registerHook('onUserCreated', async () => {})

    expect(getRegisteredHooks()).toContain('onUserCreated')
  })

  it('allows multiple handlers for the same hook', () => {
    registerHook('onUserCreated', async () => 'first')
    registerHook('onUserCreated', async () => 'second')

    expect(getRegisteredHooks()).toEqual(['onUserCreated'])
  })
})

describe('runHook', () => {
  it('calls all registered handlers with provided args', async () => {
    const handler1 = vi.fn().mockResolvedValue(undefined)
    const handler2 = vi.fn().mockResolvedValue(undefined)

    registerHook('onUserCreated', handler1)
    registerHook('onUserCreated', handler2)

    const args = { userId: '123', method: 'email' }
    await runHook('onUserCreated', args)

    expect(handler1).toHaveBeenCalledWith(args)
    expect(handler2).toHaveBeenCalledWith(args)
  })

  it('does nothing if no handlers are registered', async () => {
    await expect(runHook('onUserCreated', {})).resolves.toBeUndefined()
  })

  it('catches handler errors and continues to next handler', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const failingHandler = vi.fn().mockRejectedValue(new Error('handler broke'))
    const successHandler = vi.fn().mockResolvedValue(undefined)

    registerHook('onPaymentSucceeded', failingHandler)
    registerHook('onPaymentSucceeded', successHandler)

    await runHook('onPaymentSucceeded', { amount: 100 })

    expect(failingHandler).toHaveBeenCalled()
    expect(successHandler).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('fires onError hook when a handler fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const onErrorHandler = vi.fn().mockResolvedValue(undefined)
    registerHook('onError', onErrorHandler)

    const failingHandler = vi.fn().mockRejectedValue(new Error('boom'))
    registerHook('onUserDeleted', failingHandler)

    await runHook('onUserDeleted', { userId: '456' })

    expect(onErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        hookName: 'onUserDeleted',
        args: { userId: '456' },
      })
    )

    consoleSpy.mockRestore()
  })

  it('does not recursively fire onError when onError handler fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const failingOnError = vi.fn().mockRejectedValue(new Error('onError broke'))
    registerHook('onError', failingOnError)

    // Should not throw or infinite loop
    await expect(runHook('onError', { error: 'test' })).resolves.toBeUndefined()

    consoleSpy.mockRestore()
  })
})

describe('runBeforeHook', () => {
  it('passes args through and returns modified value', async () => {
    registerHook('beforeEmailSend', async (args) => {
      const email = args as { subject: string; body: string }
      return { ...email, subject: `[Modified] ${email.subject}` }
    })

    const result = await runBeforeHook('beforeEmailSend', {
      subject: 'Hello',
      body: 'World',
    })

    expect(result).toEqual({ subject: '[Modified] Hello', body: 'World' })
  })

  it('returns original args if no handlers are registered', async () => {
    const original = { subject: 'Hello', body: 'World' }
    const result = await runBeforeHook('beforeEmailSend', original)

    expect(result).toBe(original)
  })

  it('returns original args if handler returns null', async () => {
    registerHook('beforeEmailSend', async () => null)

    const result = await runBeforeHook('beforeEmailSend', {
      subject: 'Hello',
      body: 'World',
    })

    expect(result).toEqual({ subject: 'Hello', body: 'World' })
  })

  it('chains multiple before hooks in order', async () => {
    registerHook('beforeEmailSend', async (args) => {
      const email = args as { subject: string }
      return { ...email, subject: email.subject + ' A' }
    })
    registerHook('beforeEmailSend', async (args) => {
      const email = args as { subject: string }
      return { ...email, subject: email.subject + ' B' }
    })

    const result = await runBeforeHook('beforeEmailSend', { subject: 'Start' })

    expect(result).toEqual({ subject: 'Start A B' })
  })

  it('continues with current value if a handler errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    registerHook('beforeEmailSend', async () => {
      throw new Error('hook error')
    })

    const result = await runBeforeHook('beforeEmailSend', { subject: 'Hello' })

    expect(result).toEqual({ subject: 'Hello' })

    consoleSpy.mockRestore()
  })
})

describe('clearHooks', () => {
  it('removes all registered hooks', () => {
    registerHook('onUserCreated', async () => {})
    registerHook('onPaymentSucceeded', async () => {})

    expect(getRegisteredHooks().length).toBe(2)

    clearHooks()

    expect(getRegisteredHooks()).toEqual([])
  })
})

describe('getRegisteredHooks', () => {
  it('returns empty array when no hooks are registered', () => {
    expect(getRegisteredHooks()).toEqual([])
  })

  it('returns names of all registered hooks', () => {
    registerHook('onUserCreated', async () => {})
    registerHook('onPaymentSucceeded', async () => {})
    registerHook('onError', async () => {})

    const hooks = getRegisteredHooks()

    expect(hooks).toContain('onUserCreated')
    expect(hooks).toContain('onPaymentSucceeded')
    expect(hooks).toContain('onError')
    expect(hooks).toHaveLength(3)
  })
})

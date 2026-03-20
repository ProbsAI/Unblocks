import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { resolveUIPath, hasUIOverride, listOverrides } from './uiResolver'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>

describe('uiResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveUIPath', () => {
    it('returns override path when .tsx override exists', () => {
      mockExistsSync.mockImplementation((p: string) =>
        p === 'ui/components/Button.tsx'
      )
      const result = resolveUIPath('components', 'Button')
      expect(result).toBe('ui/components/Button.tsx')
    })

    it('returns default component path when no override exists', () => {
      mockExistsSync.mockReturnValue(false)
      const result = resolveUIPath('components', 'Button')
      expect(result).toBe('components/Button')
    })

    it('returns default layout path when no override exists', () => {
      mockExistsSync.mockReturnValue(false)
      const result = resolveUIPath('layouts', 'dashboard')
      expect(result).toBe('app/dashboard')
    })

    it('returns default page path when no override exists', () => {
      mockExistsSync.mockReturnValue(false)
      const result = resolveUIPath('pages', 'pricing')
      expect(result).toBe('app/pricing')
    })

    it('returns default email-templates path when no override exists', () => {
      mockExistsSync.mockReturnValue(false)
      const result = resolveUIPath('email-templates', 'welcome')
      expect(result).toBe('core/email/welcome')
    })

    it('checks .tsx first then .ts then .jsx then .js', () => {
      const calls: string[] = []
      mockExistsSync.mockImplementation((p: string) => {
        calls.push(p)
        return p === 'ui/components/Card.ts'
      })
      const result = resolveUIPath('components', 'Card')
      expect(result).toBe('ui/components/Card.ts')
      // .tsx should be checked before .ts
      expect(calls.indexOf('ui/components/Card.tsx')).toBeLessThan(
        calls.indexOf('ui/components/Card.ts')
      )
    })
  })

  describe('hasUIOverride', () => {
    it('returns true when override file exists', () => {
      mockExistsSync.mockImplementation((p: string) =>
        p === 'ui/components/Hero.tsx'
      )
      expect(hasUIOverride('components', 'Hero')).toBe(true)
    })

    it('returns false when no override file exists', () => {
      mockExistsSync.mockReturnValue(false)
      expect(hasUIOverride('components', 'Hero')).toBe(false)
    })
  })

  describe('listOverrides', () => {
    it('returns empty array', () => {
      mockExistsSync.mockReturnValue(false)
      const result = listOverrides()
      expect(result).toEqual([])
    })
  })
})

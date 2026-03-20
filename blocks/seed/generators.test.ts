import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateEmail,
  generateUserName,
  generateTeamName,
  generateTeamSlug,
  generateJobType,
  generateNotificationTitle,
  generateFileName,
  generateFileMimeType,
  generateFileSize,
  resetSeedCounter,
} from './generators'

describe('generators', () => {
  beforeEach(() => {
    resetSeedCounter()
  })

  describe('generateEmail', () => {
    it('returns a valid email format', () => {
      const email = generateEmail(0)
      expect(email).toMatch(/^[a-z]+\.[a-z]+\d+@example\.com$/)
    })

    it('generates different emails for different indices', () => {
      const email0 = generateEmail(0)
      const email1 = generateEmail(1)
      expect(email0).not.toBe(email1)
    })
  })

  describe('generateUserName', () => {
    it('returns "First Last" format', () => {
      const name = generateUserName(0)
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    })

    it('generates different names for different indices', () => {
      expect(generateUserName(0)).not.toBe(generateUserName(1))
    })
  })

  describe('generateTeamName', () => {
    it('returns a predefined name for index within array length', () => {
      const name = generateTeamName(0)
      expect(name).toBe('Engineering')
    })

    it('returns a name with index suffix for index beyond array length', () => {
      const name = generateTeamName(100)
      expect(name).toMatch(/\w+ 100$/)
    })
  })

  describe('generateTeamSlug', () => {
    it('returns a predefined slug for index within array length', () => {
      const slug = generateTeamSlug(0)
      expect(slug).toBe('engineering')
    })

    it('returns a slug with index suffix for index beyond array length', () => {
      const slug = generateTeamSlug(100)
      expect(slug).toMatch(/^[a-z-]+-100$/)
    })
  })

  describe('generateJobType', () => {
    it('returns a non-empty string', () => {
      const type = generateJobType()
      expect(typeof type).toBe('string')
      expect(type.length).toBeGreaterThan(0)
    })
  })

  describe('generateNotificationTitle', () => {
    it('returns a non-empty string', () => {
      const title = generateNotificationTitle()
      expect(typeof title).toBe('string')
      expect(title.length).toBeGreaterThan(0)
    })
  })

  describe('generateFileName', () => {
    it('returns a filename with extension', () => {
      const name = generateFileName(0)
      expect(name).toMatch(/^.+\.\w+$/)
    })

    it('includes index in filename', () => {
      const name = generateFileName(3)
      expect(name).toContain('3')
    })
  })

  describe('generateFileMimeType', () => {
    it('returns correct MIME type for png', () => {
      expect(generateFileMimeType('photo.png')).toBe('image/png')
    })

    it('returns correct MIME type for jpg', () => {
      expect(generateFileMimeType('photo.jpg')).toBe('image/jpeg')
    })

    it('returns correct MIME type for pdf', () => {
      expect(generateFileMimeType('doc.pdf')).toBe('application/pdf')
    })

    it('returns correct MIME type for csv', () => {
      expect(generateFileMimeType('data.csv')).toBe('text/csv')
    })

    it('returns correct MIME type for json', () => {
      expect(generateFileMimeType('config.json')).toBe('application/json')
    })

    it('returns octet-stream for unknown extension', () => {
      expect(generateFileMimeType('file.xyz')).toBe('application/octet-stream')
    })
  })

  describe('generateFileSize', () => {
    it('returns a positive number', () => {
      const size = generateFileSize()
      expect(size).toBeGreaterThan(0)
    })

    it('returns a number within expected range', () => {
      const size = generateFileSize()
      expect(size).toBeGreaterThanOrEqual(1_000)
      expect(size).toBeLessThanOrEqual(5_001_000)
    })
  })

  describe('resetSeedCounter', () => {
    it('resets internal state so generators using pick restart', () => {
      // Call generateTeamName beyond array to use pick(), advancing the counter
      generateTeamName(100)
      generateTeamName(101)

      resetSeedCounter()

      // After reset, the first pick() call should start from the beginning
      const name1 = generateTeamName(100)
      resetSeedCounter()
      const name2 = generateTeamName(100)
      expect(name1).toBe(name2)
    })
  })
})

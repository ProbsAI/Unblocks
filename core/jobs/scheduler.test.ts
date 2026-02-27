import { describe, it, expect } from 'vitest'
import { matchesCron } from './scheduler'

describe('matchesCron', () => {
  it('* * * * * matches any time', () => {
    const date = new Date(2026, 1, 27, 14, 30) // Feb 27, 2026 14:30
    expect(matchesCron('* * * * *', date)).toBe(true)
  })

  it('matches with different dates for wildcard', () => {
    expect(matchesCron('* * * * *', new Date(2026, 0, 1, 0, 0))).toBe(true)
    expect(matchesCron('* * * * *', new Date(2026, 11, 31, 23, 59))).toBe(true)
  })

  it('0 * * * * matches only minute 0', () => {
    const atZero = new Date(2026, 1, 27, 14, 0)
    const atFive = new Date(2026, 1, 27, 14, 5)

    expect(matchesCron('0 * * * *', atZero)).toBe(true)
    expect(matchesCron('0 * * * *', atFive)).toBe(false)
  })

  it('*/5 * * * * matches every 5 minutes', () => {
    expect(matchesCron('*/5 * * * *', new Date(2026, 1, 27, 14, 0))).toBe(true)
    expect(matchesCron('*/5 * * * *', new Date(2026, 1, 27, 14, 5))).toBe(true)
    expect(matchesCron('*/5 * * * *', new Date(2026, 1, 27, 14, 10))).toBe(true)
    expect(matchesCron('*/5 * * * *', new Date(2026, 1, 27, 14, 15))).toBe(true)
    expect(matchesCron('*/5 * * * *', new Date(2026, 1, 27, 14, 3))).toBe(false)
    expect(matchesCron('*/5 * * * *', new Date(2026, 1, 27, 14, 7))).toBe(false)
  })

  it('*/15 * * * * matches every 15 minutes', () => {
    expect(matchesCron('*/15 * * * *', new Date(2026, 1, 27, 14, 0))).toBe(true)
    expect(matchesCron('*/15 * * * *', new Date(2026, 1, 27, 14, 15))).toBe(true)
    expect(matchesCron('*/15 * * * *', new Date(2026, 1, 27, 14, 30))).toBe(true)
    expect(matchesCron('*/15 * * * *', new Date(2026, 1, 27, 14, 45))).toBe(true)
    expect(matchesCron('*/15 * * * *', new Date(2026, 1, 27, 14, 10))).toBe(false)
  })

  it('1,15,30 * * * * matches specific minutes', () => {
    expect(matchesCron('1,15,30 * * * *', new Date(2026, 1, 27, 14, 1))).toBe(true)
    expect(matchesCron('1,15,30 * * * *', new Date(2026, 1, 27, 14, 15))).toBe(true)
    expect(matchesCron('1,15,30 * * * *', new Date(2026, 1, 27, 14, 30))).toBe(true)
    expect(matchesCron('1,15,30 * * * *', new Date(2026, 1, 27, 14, 0))).toBe(false)
    expect(matchesCron('1,15,30 * * * *', new Date(2026, 1, 27, 14, 20))).toBe(false)
  })

  it('0-5 * * * * matches range of minutes 0 through 5', () => {
    expect(matchesCron('0-5 * * * *', new Date(2026, 1, 27, 14, 0))).toBe(true)
    expect(matchesCron('0-5 * * * *', new Date(2026, 1, 27, 14, 3))).toBe(true)
    expect(matchesCron('0-5 * * * *', new Date(2026, 1, 27, 14, 5))).toBe(true)
    expect(matchesCron('0-5 * * * *', new Date(2026, 1, 27, 14, 6))).toBe(false)
    expect(matchesCron('0-5 * * * *', new Date(2026, 1, 27, 14, 59))).toBe(false)
  })

  it('matches specific hour', () => {
    expect(matchesCron('0 9 * * *', new Date(2026, 1, 27, 9, 0))).toBe(true)
    expect(matchesCron('0 9 * * *', new Date(2026, 1, 27, 10, 0))).toBe(false)
  })

  it('matches specific day of month', () => {
    expect(matchesCron('0 0 1 * *', new Date(2026, 1, 1, 0, 0))).toBe(true)
    expect(matchesCron('0 0 1 * *', new Date(2026, 1, 2, 0, 0))).toBe(false)
  })

  it('matches specific month', () => {
    // Month is 1-indexed in cron: 3 = March
    expect(matchesCron('0 0 1 3 *', new Date(2026, 2, 1, 0, 0))).toBe(true)  // March
    expect(matchesCron('0 0 1 3 *', new Date(2026, 1, 1, 0, 0))).toBe(false) // February
  })

  it('matches specific day of week', () => {
    // Feb 27, 2026 is a Friday (day 5)
    expect(matchesCron('* * * * 5', new Date(2026, 1, 27, 14, 30))).toBe(true)
    expect(matchesCron('* * * * 1', new Date(2026, 1, 27, 14, 30))).toBe(false)
  })

  it('returns false for invalid cron with wrong number of fields', () => {
    const date = new Date(2026, 1, 27, 14, 30)
    expect(matchesCron('* * *', date)).toBe(false)
    expect(matchesCron('* * * * * *', date)).toBe(false)
    expect(matchesCron('', date)).toBe(false)
    expect(matchesCron('*', date)).toBe(false)
  })

  it('handles extra whitespace in cron expression', () => {
    const date = new Date(2026, 1, 27, 14, 0)
    expect(matchesCron('  0  *  *  *  *  ', date)).toBe(true)
  })
})

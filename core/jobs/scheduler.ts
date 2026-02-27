import { enqueueJob } from './queue'
import { loadConfig } from '../runtime/configLoader'

let schedulerTimer: ReturnType<typeof setInterval> | null = null
let running = false

/**
 * Parse a simple cron expression and check if it matches the current time.
 * Supports: minute hour dayOfMonth month dayOfWeek
 * Supports: * (any), specific numbers, and step values (star/n)
 */
export function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const fields = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay(),
  ]

  return parts.every((part, i) => matchesCronField(part, fields[i]))
}

function matchesCronField(pattern: string, value: number): boolean {
  if (pattern === '*') return true

  // Step values: */5 means every 5
  if (pattern.startsWith('*/')) {
    const step = parseInt(pattern.slice(2), 10)
    return !isNaN(step) && step > 0 && value % step === 0
  }

  // Comma-separated: 1,15,30
  if (pattern.includes(',')) {
    return pattern.split(',').some((p) => matchesCronField(p.trim(), value))
  }

  // Range: 1-5
  if (pattern.includes('-')) {
    const [min, max] = pattern.split('-').map(Number)
    return !isNaN(min) && !isNaN(max) && value >= min && value <= max
  }

  // Exact match
  return parseInt(pattern, 10) === value
}

/**
 * Start the scheduler. Checks every minute for scheduled jobs.
 */
export function startScheduler(): void {
  if (running) return
  running = true

  // Check every 60 seconds
  schedulerTimer = setInterval(tick, 60_000)

  // Initial check
  tick()
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  running = false
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

/**
 * Check if the scheduler is running.
 */
export function isSchedulerRunning(): boolean {
  return running
}

async function tick(): Promise<void> {
  const config = loadConfig('jobs')
  const now = new Date()

  for (const schedule of config.schedules) {
    if (!schedule.enabled) continue

    try {
      if (matchesCron(schedule.cron, now)) {
        await enqueueJob({
          type: schedule.jobType,
          payload: schedule.payload ?? {},
          dedupeKey: `schedule:${schedule.name}:${now.getMinutes()}:${now.getHours()}`,
        })
      }
    } catch (err) {
      console.error(`[scheduler] Error scheduling ${schedule.name}:`, err)
    }
  }
}

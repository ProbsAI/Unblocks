/**
 * Seed Block — Type Definitions
 *
 * Configuration for the seed data generator.
 */
import { z } from 'zod'

export const SeedConfigSchema = z.object({
  /** Number of regular users to create */
  userCount: z.number().min(0).default(20),
  /** Number of admin users to create */
  adminCount: z.number().min(0).default(2),
  /** Number of teams to create */
  teamCount: z.number().min(0).default(5),
  /** Max members per team */
  maxMembersPerTeam: z.number().min(1).default(8),
  /** Number of notifications per user */
  notificationsPerUser: z.number().min(0).default(10),
  /** Number of jobs to seed */
  jobCount: z.number().min(0).default(30),
  /** Number of files to seed */
  fileCount: z.number().min(0).default(15),
  /** Default password for seeded users */
  defaultPassword: z.string().default('password123'),
  /** Whether to clear existing data before seeding */
  clearFirst: z.boolean().default(true),
})

export type SeedConfig = z.infer<typeof SeedConfigSchema>

export interface SeedResult {
  users: number
  admins: number
  teams: number
  teamMembers: number
  notifications: number
  jobs: number
  files: number
  duration: number
}

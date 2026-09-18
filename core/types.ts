import { z } from 'zod'

const CtaSchema = z.object({
  text: z.string(),
  href: z.string(),
})

const FeatureSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
})

const TestimonialSchema = z.object({
  name: z.string(),
  role: z.string(),
  company: z.string(),
  quote: z.string(),
  avatarUrl: z.string().optional(),
})

const FaqSchema = z.object({
  question: z.string(),
  answer: z.string(),
})

export const AppConfigSchema = z.object({
  name: z.string().default('MyApp'),
  tagline: z.string().default('The best way to do X'),
  description: z.string().default('A longer description for SEO meta tags.'),
  url: z.string().url().default('http://localhost:3000'),

  landing: z.object({
    hero: z.object({
      title: z.string().default('Welcome'),
      subtitle: z.string().default('Get started today.'),
      cta: CtaSchema.default({ text: 'Get Started', href: '/signup' }),
      secondaryCta: CtaSchema.optional(),
    }).default({}),
    features: z.array(FeatureSchema).default([]),
    testimonials: z.array(TestimonialSchema).default([]),
    faq: z.array(FaqSchema).default([]),
  }).default({}),

  /**
   * How personally identifying data is stored.
   *
   * **This is an install-time decision, not a setting to flip later.** It
   * decides which column a user's address lives in, so changing it after any
   * user exists makes every lookup miss: rows written in plaintext mode carry
   * no `email_hash` to match, and rows written encrypted carry no plaintext.
   * Nobody would be able to sign in, and it would look like data loss rather
   * than a configuration error. `assertPiiStorageMatchesData()` checks for that
   * mismatch and fails loudly instead.
   */
  privacy: z.object({
    /**
     * true  — addresses are stored only as ciphertext, with a keyed blind
     *         index where a lookup needs one. A database dump without
     *         ENCRYPTION_KEY / BLIND_INDEX_KEY does not reveal them.
     * false — addresses are stored in the clear. Simpler, and it keeps
     *         substring search in the admin panel, which a blind index cannot
     *         support.
     *
     * Choosing `true` makes BLIND_INDEX_KEY as critical as your database
     * backup: lose it and no user can ever be looked up again.
     *
     * Install-time, not a runtime toggle. Changing it while rows exist strands
     * them — run `npm run db:migrate-email-storage` to move between modes.
     */
    encryptUserEmail: z.boolean().default(true),
  }).default({}),

  // Scope, stated precisely because the name is a promise: this governs every
  // table that holds an address — `users`, `verification_tokens` and
  // `team_invitations` — under the one setting. They differ only in what each
  // needs: the first two are looked up BY address and carry a blind index,
  // while verification_tokens is only ever found by token_hash and stores
  // ciphertext alone. See core/security/piiStorage.ts.

  seo: z.object({
    titleTemplate: z.string().default('%s | MyApp'),
    defaultOgImage: z.string().default('/og-image.png'),
  }).default({}),

  social: z.object({
    twitter: z.string().default(''),
    github: z.string().default(''),
    discord: z.string().default(''),
  }).default({}),

  footer: z.object({
    showUnblocksAttribution: z.boolean().default(true),
    unblocksLicenseKey: z.string().default(''),
  }).default({}),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

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
      title: z.string(),
      subtitle: z.string(),
      cta: CtaSchema,
      secondaryCta: CtaSchema.optional(),
    }),
    features: z.array(FeatureSchema).default([]),
    testimonials: z.array(TestimonialSchema).default([]),
    faq: z.array(FaqSchema).default([]),
  }),

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

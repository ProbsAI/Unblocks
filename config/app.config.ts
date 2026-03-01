import type { AppConfig } from '@unblocks/core/types'

const appConfig: AppConfig = {
  name: 'MyApp',
  tagline: 'The best way to do X',
  description: 'Build your SaaS in minutes, not months.',
  url: process.env.APP_URL ?? 'http://localhost:3000',

  landing: {
    hero: {
      title: 'Ship your SaaS in minutes, not months',
      subtitle:
        'The AI-native open-source foundation with auth, billing, and everything you need to launch.',
      cta: { text: 'Get Started Free', href: '/signup' },
      secondaryCta: { text: 'View Pricing', href: '/pricing' },
    },
    features: [
      {
        icon: 'shield',
        title: 'Authentication',
        description:
          'Email/password, Google OAuth, magic links — ready out of the box.',
      },
      {
        icon: 'credit-card',
        title: 'Billing & Subscriptions',
        description:
          'Stripe integration with checkout, webhooks, and customer portal.',
      },
      {
        icon: 'zap',
        title: 'AI-Native',
        description:
          'Built for AI coding agents. CLAUDE.md instructions make every AI session productive.',
      },
      {
        icon: 'layout',
        title: 'Landing Page',
        description:
          'Beautiful, config-driven landing page with hero, features, pricing, and FAQ.',
      },
      {
        icon: 'lock',
        title: 'Security',
        description:
          'CSRF protection, rate limiting, secure cookies, and CSP headers built in.',
      },
      {
        icon: 'mail',
        title: 'Transactional Email',
        description:
          'Welcome, password reset, and invoice emails via Resend.',
      },
    ],
    testimonials: [],
    faq: [
      {
        question: 'Is it really free?',
        answer:
          'Yes. Unblocks is MIT licensed. Use it for personal or commercial projects at no cost.',
      },
      {
        question: 'Can I use it for commercial projects?',
        answer:
          'Absolutely. The MIT license allows unlimited commercial use.',
      },
      {
        question: 'What do I need to get started?',
        answer:
          'Node.js 20+, PostgreSQL, and optionally Redis. See the setup guide for details.',
      },
      {
        question: 'How does billing work?',
        answer:
          'Billing is powered by Stripe. Configure your plans in billing.config.ts and you are ready to accept payments.',
      },
    ],
  },

  seo: {
    titleTemplate: '%s | MyApp',
    defaultOgImage: '/og-image.png',
  },

  social: {
    twitter: '',
    github: '',
    discord: '',
  },

  footer: {
    showUnblocksAttribution: true,
    unblocksLicenseKey: '',
  },
}

export default appConfig

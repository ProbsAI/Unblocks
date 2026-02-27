import Link from 'next/link'

interface HeroProps {
  title: string
  subtitle: string
  cta: { text: string; href: string }
  secondaryCta?: { text: string; href: string }
}

export function Hero({ title, subtitle, cta, secondaryCta }: HeroProps) {
  return (
    <section className="px-4 py-24 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {subtitle}
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href={cta.href}
            className="rounded-md bg-primary px-8 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-hover"
          >
            {cta.text}
          </Link>
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="rounded-md border border-border px-8 py-3 text-base font-medium text-foreground hover:bg-muted"
            >
              {secondaryCta.text}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}

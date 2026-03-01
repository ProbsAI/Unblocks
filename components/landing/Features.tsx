interface Feature {
  icon: string
  title: string
  description: string
}

interface FeaturesProps {
  features: Feature[]
}

const iconMap: Record<string, string> = {
  shield: '\u{1F6E1}',
  'credit-card': '\u{1F4B3}',
  zap: '\u26A1',
  layout: '\u{1F4D0}',
  lock: '\u{1F512}',
  mail: '\u2709',
  chart: '\u{1F4C8}',
  users: '\u{1F465}',
  code: '\u{1F4BB}',
  globe: '\u{1F30D}',
}

export function Features({ features }: FeaturesProps) {
  if (features.length === 0) return null

  return (
    <section className="border-t border-border bg-muted/50 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-foreground">
          Everything you need to launch
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Built-in features that would take weeks to implement from scratch.
        </p>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-white p-6"
            >
              <div className="text-3xl">
                {iconMap[feature.icon] ?? '\u2B50'}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'

interface FaqItem {
  question: string
  answer: string
}

interface FAQProps {
  items: FaqItem[]
}

export function FAQ({ items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (items.length === 0) return null

  return (
    <section className="border-t border-border px-4 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-bold text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-12 divide-y divide-border">
          {items.map((item, index) => (
            <div key={index} className="py-6">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              >
                <span className="text-base font-medium text-foreground">
                  {item.question}
                </span>
                <span className="ml-4 text-muted-foreground">
                  {openIndex === index ? '\u2212' : '+'}
                </span>
              </button>
              {openIndex === index ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

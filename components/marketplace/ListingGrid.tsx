'use client'

interface Listing {
  id: string
  title: string
  price: number
  seller: string
  category: string
}

interface ListingGridProps {
  listings: Listing[]
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function ListingGrid({ listings }: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center">
        <p className="text-muted-foreground">No listings available.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back later or create your own listing.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <div
          key={listing.id}
          className="rounded-lg border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="mb-3">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {listing.category}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{listing.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">by {listing.seller}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-bold text-foreground">
              {formatPrice(listing.price)}
            </span>
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover">
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

import { getCurrentUser } from '@/lib/serverAuth'
import { Card } from '@/components/ui/Card'
import { ListingGrid } from '@/components/marketplace/ListingGrid'

export const metadata = { title: 'Marketplace' }

const mockListings = [
  { id: '1', title: 'Next.js SaaS Template', price: 4900, seller: 'DevTools Inc.', category: 'Digital Products' },
  { id: '2', title: 'UI Component Library', price: 2900, seller: 'DesignCo', category: 'Digital Products' },
  { id: '3', title: 'API Integration Service', price: 15000, seller: 'CloudBridge', category: 'Services' },
  { id: '4', title: 'Custom Dashboard Theme', price: 1900, seller: 'ThemeCraft', category: 'Digital Products' },
  { id: '5', title: 'Data Migration Toolkit', price: 7900, seller: 'DataFlow Labs', category: 'Digital Products' },
  { id: '6', title: 'DevOps Consulting (1hr)', price: 20000, seller: 'InfraExperts', category: 'Services' },
]

export default async function MarketplacePage() {
  await getCurrentUser()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and purchase products, services, and digital assets
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
          Create Listing
        </button>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search listings..."
            className="w-full rounded-md border border-border bg-white px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled
          />
          <select
            className="rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground"
            disabled
          >
            <option>All Categories</option>
            <option>Digital Products</option>
            <option>Services</option>
            <option>Physical Products</option>
          </select>
        </div>
      </Card>

      <ListingGrid listings={mockListings} />
    </div>
  )
}

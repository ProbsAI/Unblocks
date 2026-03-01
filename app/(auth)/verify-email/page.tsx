import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'Verify Email' }

export default function VerifyEmailPage() {
  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        Check your email
      </h1>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        We&apos;ve sent a verification link to your email address. Click the
        link to verify your account.
      </p>
      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-primary hover:underline"
        >
          Back to login
        </Link>
      </div>
    </Card>
  )
}

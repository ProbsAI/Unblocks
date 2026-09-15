import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { peekMagicLink } from '@unblocks/core/auth'
import { getCurrentUser } from '@/lib/serverAuth'

export const metadata = { title: 'Confirm sign-in' }

/**
 * The interstitial that turns an emailed magic link into a same-origin POST.
 *
 * This page is the whole CSRF defence for magic-link sign-in. It must not
 * create a session itself — see the comment in
 * app/api/auth/magic-link/verify/route.ts for why a GET cannot be trusted with
 * that — so it only reads the token (peekMagicLink leaves it unused) and asks.
 *
 * Naming the destination account is the part that matters. A link planted by
 * an attacker shows the ATTACKER's address here, which is the signal a
 * recipient needs in order to refuse.
 */

function InvalidLink() {
  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        This link is no longer valid
      </h1>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Magic links expire after 15 minutes and can only be used once. Request a
        new one to sign in.
      </p>
      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to login
        </Link>
      </div>
    </Card>
  )
}

export default async function MagicLinkConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) return <InvalidLink />

  const target = await peekMagicLink(token)
  if (!target) return <InvalidLink />

  const signedIn = await getCurrentUser()

  // The address being signed out of, or null when this is not a switch. Kept as
  // a value rather than a boolean so the copy below cannot reference a
  // currently-signed-in user that does not exist.
  const switchingFrom =
    signedIn && signedIn.email !== target.email ? signedIn.email : null

  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        Confirm sign-in
      </h1>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        You&apos;re about to sign in as
      </p>
      <p className="mt-1 text-center text-base font-medium break-all text-foreground">
        {target.email}
      </p>

      {switchingFrom ? (
        <div className="mt-6 rounded-md border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-foreground">
            This will switch accounts
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re currently signed in as{' '}
            <span className="font-medium break-all text-foreground">
              {switchingFrom}
            </span>
            . Continuing signs you out of that account on this device.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            If you didn&apos;t ask for a link for{' '}
            <span className="break-all">{target.email}</span>, close this page —
            someone else may be trying to get you to work inside their account.
          </p>
        </div>
      ) : (
        // The signed-out case is the primary attack scenario: a planted link
        // names an address the recipient has never seen. Say so plainly rather
        // than relying on them to notice.
        <p className="mt-4 text-center text-sm text-muted-foreground">
          If that isn&apos;t your address, close this page — the link was not
          meant for you.
        </p>
      )}

      <form
        action="/api/auth/magic-link/verify"
        method="post"
        className="mt-6 space-y-3"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="confirm" value="1" />
        {switchingFrom ? (
          <input type="hidden" name="switch_account" value="1" />
        ) : null}

        <Button type="submit" className="w-full" size="lg">
          {switchingFrom ? `Switch to ${target.email}` : 'Sign in'}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href={switchingFrom ? '/dashboard' : '/login'}
          className="text-sm text-primary hover:underline"
        >
          {switchingFrom ? `Stay signed in as ${switchingFrom}` : 'Cancel'}
        </Link>
      </div>
    </Card>
  )
}

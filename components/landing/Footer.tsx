import Link from 'next/link'

interface FooterProps {
  appName: string
  showAttribution: boolean
}

export function Footer({ appName, showAttribution }: FooterProps) {
  return (
    <footer className="border-t border-border bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {appName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            {showAttribution ? (
              <a
                href="https://unblocks.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Built with Unblocks
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  )
}

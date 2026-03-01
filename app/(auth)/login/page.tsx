import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { LoginForm } from '@/components/auth/LoginForm'
import { SocialButtons } from '@/components/auth/SocialButtons'

export const metadata = { title: 'Log in' }

export default function LoginPage() {
  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        Welcome back
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Log in to your account to continue
      </p>

      <div className="mt-6">
        <SocialButtons />
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <LoginForm />

      <div className="mt-6 space-y-2 text-center text-sm">
        <p>
          <Link
            href="/reset-password"
            className="text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
        <p className="text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </Card>
  )
}

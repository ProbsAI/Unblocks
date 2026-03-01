import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SocialButtons } from '@/components/auth/SocialButtons'

export const metadata = { title: 'Sign up' }

export default function SignupPage() {
  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        Create your account
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Get started for free — no credit card required
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
            Or continue with email
          </span>
        </div>
      </div>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  )
}

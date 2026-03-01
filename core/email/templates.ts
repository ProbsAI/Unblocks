function baseLayout(content: string, appName: string = 'MyApp'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .footer { text-align: center; margin-top: 24px; color: #94a3b8; font-size: 14px; }
    h1 { color: #0f172a; font-size: 24px; margin: 0 0 16px 0; }
    p { color: #475569; line-height: 1.6; margin: 0 0 16px 0; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
}

export function welcomeEmail(args: {
  userName: string
  loginUrl: string
  appName?: string
}): { subject: string; html: string } {
  const appName = args.appName ?? 'MyApp'
  return {
    subject: `Welcome to ${appName}!`,
    html: baseLayout(`
      <h1>Welcome, ${args.userName || 'there'}!</h1>
      <p>We're excited to have you on board. Your account is ready to use.</p>
      <hr>
      <p style="text-align: center;">
        <a href="${args.loginUrl}" class="button">Go to Dashboard</a>
      </p>
      <p style="font-size: 14px; color: #94a3b8;">
        If you didn't create this account, you can safely ignore this email.
      </p>
    `, appName),
  }
}

export function resetPasswordEmail(args: {
  userName: string
  resetUrl: string
  appName?: string
}): { subject: string; html: string } {
  const appName = args.appName ?? 'MyApp'
  return {
    subject: `Reset your ${appName} password`,
    html: baseLayout(`
      <h1>Reset Your Password</h1>
      <p>Hi ${args.userName || 'there'},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <hr>
      <p style="text-align: center;">
        <a href="${args.resetUrl}" class="button">Reset Password</a>
      </p>
      <p style="font-size: 14px; color: #94a3b8;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    `, appName),
  }
}

export function magicLinkEmail(args: {
  loginUrl: string
  appName?: string
}): { subject: string; html: string } {
  const appName = args.appName ?? 'MyApp'
  return {
    subject: `Sign in to ${appName}`,
    html: baseLayout(`
      <h1>Sign In</h1>
      <p>Click the button below to sign in to your account.</p>
      <hr>
      <p style="text-align: center;">
        <a href="${args.loginUrl}" class="button">Sign In</a>
      </p>
      <p style="font-size: 14px; color: #94a3b8;">
        This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    `, appName),
  }
}

export function verifyEmailTemplate(args: {
  userName: string
  verifyUrl: string
  appName?: string
}): { subject: string; html: string } {
  const appName = args.appName ?? 'MyApp'
  return {
    subject: `Verify your email for ${appName}`,
    html: baseLayout(`
      <h1>Verify Your Email</h1>
      <p>Hi ${args.userName || 'there'},</p>
      <p>Please verify your email address to get full access to your account.</p>
      <hr>
      <p style="text-align: center;">
        <a href="${args.verifyUrl}" class="button">Verify Email</a>
      </p>
      <p style="font-size: 14px; color: #94a3b8;">
        This link expires in 24 hours.
      </p>
    `, appName),
  }
}

export function paymentSuccessEmail(args: {
  userName: string
  amount: number
  plan: string
  invoiceUrl: string | null
  appName?: string
}): { subject: string; html: string } {
  const appName = args.appName ?? 'MyApp'
  return {
    subject: `Payment received — ${appName}`,
    html: baseLayout(`
      <h1>Payment Received</h1>
      <p>Hi ${args.userName || 'there'},</p>
      <p>We've successfully processed your payment of <strong>$${args.amount.toFixed(2)}</strong> for the <strong>${args.plan}</strong> plan.</p>
      ${args.invoiceUrl ? `
      <hr>
      <p style="text-align: center;">
        <a href="${args.invoiceUrl}" class="button">View Invoice</a>
      </p>
      ` : ''}
      <p style="font-size: 14px; color: #94a3b8;">
        Thank you for your continued support!
      </p>
    `, appName),
  }
}

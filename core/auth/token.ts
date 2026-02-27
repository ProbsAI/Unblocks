import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is required')
  return new TextEncoder().encode(secret)
}

export interface TokenPayload {
  userId: string
  sessionId: string
  type: 'session' | 'email_verification' | 'password_reset' | 'magic_link'
}

export async function createToken(
  payload: TokenPayload,
  expiresIn: string = '7d'
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

export function generateRandomToken(): string {
  return randomBytes(32).toString('hex')
}

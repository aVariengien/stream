import { cookies } from 'next/headers'
import crypto from 'crypto'

const AUTH_COOKIE = 'stream_session'
const SESSION_SECRET = 'stream-app-session-signing-key-2024'

export interface Session {
  userId: string
  username: string
}

// Verify and decode session token
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(AUTH_COOKIE)
    
    if (!sessionCookie?.value) {
      return null
    }

    const [dataB64, signature] = sessionCookie.value.split('.')
    if (!dataB64 || !signature) return null
    
    const data = Buffer.from(dataB64, 'base64').toString()
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
    
    if (signature !== expectedSig) return null
    
    const parsed = JSON.parse(data)
    if (parsed.exp < Date.now()) return null
    
    return { userId: parsed.userId, username: parsed.username }
  } catch {
    return null
  }
}

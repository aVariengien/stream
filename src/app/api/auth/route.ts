import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'
import crypto from 'crypto'

const AUTH_COOKIE = 'stream_session'
const SESSION_SECRET = 'your-secret-password-here'

// Simple password hashing using SHA-256 with salt
function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + salt + SESSION_SECRET).digest('hex')
}

// Create a session token
function createSessionToken(userId: string, username: string): string {
  const data = JSON.stringify({ userId, username, exp: Date.now() + 365 * 24 * 60 * 60 * 1000 })
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
  return Buffer.from(data).toString('base64') + '.' + signature
}

// Verify and decode session token
function verifySessionToken(token: string): { userId: string; username: string } | null {
  try {
    const [dataB64, signature] = token.split('.')
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

// Login
export async function POST(request: NextRequest) {
  try {
    const { username, password, action } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const supabase = getSupabase()

    if (action === 'register') {
      // Check if username exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      }

      // Create user
      const salt = crypto.randomBytes(16).toString('hex')
      const passwordHash = salt + ':' + hashPassword(password, salt)

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          username: username.toLowerCase(),
          password_hash: passwordHash,
        })
        .select('id, username')
        .single()

      if (error || !newUser) {
        console.error('Failed to create user:', error)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
      }

      // Create session
      const token = createSessionToken(newUser.id, newUser.username)
      const cookieStore = await cookies()
      cookieStore.set(AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      })

      return NextResponse.json({ success: true, username: newUser.username })
    }

    // Login
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash')
      .eq('username', username.toLowerCase())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Verify password
    const [salt, storedHash] = user.password_hash.split(':')
    const inputHash = hashPassword(password, salt)

    if (inputHash !== storedHash) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Create session
    const token = createSessionToken(user.id, user.username)
    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    })

    return NextResponse.json({ success: true, username: user.username })
  } catch (err) {
    console.error('Auth error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// Check auth status
export async function GET() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(AUTH_COOKIE)
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ authenticated: false })
  }

  const session = verifySessionToken(sessionCookie.value)
  
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }

  return NextResponse.json({ 
    authenticated: true, 
    userId: session.userId,
    username: session.username 
  })
}

// Logout
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE)
  return NextResponse.json({ success: true })
}

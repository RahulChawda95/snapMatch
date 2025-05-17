import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Custom getUserFromToken function
async function getUserFromToken(request: NextRequest): Promise<any> {
  try {
    const token = request.cookies.get('auth_token')?.value
    
    if (!token) {
      console.log('No auth token found in cookies')
      return null
    }
    
    // Secret key for JWT
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fallback_secret_key_do_not_use_in_production'
    )
    
    console.log('Verifying token...')
    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    if (!payload || !payload.userId) {
      console.log('Invalid payload in token:', payload)
      return null
    }
    
    console.log('Valid user token found for user ID:', payload.userId)
    return payload
  } catch (error) {
    console.error('Error verifying token:', error)
    return null
  }
}

// Paths that require authentication
const protectedPaths = [
  '/admin',
  '/api/events',
  '/api/auth/user',
  '/api/download'
]

// Function to check if the path is protected
function isProtectedPath(path: string): boolean {
  return protectedPaths.some(prefix => {
    // Exact match
    if (prefix === path) return true
    
    // Starts with prefix and next char is either '/' or end of string
    if (path.startsWith(prefix) && (path.length === prefix.length || path[prefix.length] === '/')) {
      return true
    }
    
    return false
  })
}

// Excluded paths (don't check auth)
const excludedPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/event'
]

// Function to check if the path is excluded
function isExcludedPath(path: string): boolean {
  return excludedPaths.some(prefix => path.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip auth check for static files and excluded paths
  if (
    pathname.includes('/_next') || 
    pathname.includes('/favicon.ico') ||
    pathname.includes('/uploads') ||
    isExcludedPath(pathname)
  ) {
    return NextResponse.next()
  }
  
  // Check if the path requires authentication
  if (isProtectedPath(pathname)) {
    // Get user from token
    const user = await getUserFromToken(request)
    
    // If no user is found, redirect to login page
    if (!user) {
      // API routes should return 401 status
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { message: 'Unauthorized' },
          { status: 401 }
        )
      }
      
      // Web routes should redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('callbackUrl', encodeURI(request.nextUrl.pathname))
      return NextResponse.redirect(url)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

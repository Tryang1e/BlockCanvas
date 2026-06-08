import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const path = url.pathname
  
  // 1. Get hostname (Support x-forwarded-host for tunnels)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const originalHost = request.headers.get('host') || ''
  let hostname = forwardedHost || originalHost
  hostname = hostname.includes(':') ? hostname.split(':')[0] : hostname

  // 2. Define root domain
  const rootDomain = 'craftopia.work'
  const isLocal = hostname.endsWith('localhost') || hostname.includes('127.0.0.1')

  // 3. Extract subdomain (Improved Robustness)
  const parts = hostname.split('.')
  let subdomain = ''

  if (isLocal) {
    // Handles test.localhost or test.localhost:3000
    if (parts.length > 1 && parts[parts.length - 1] === 'localhost') {
      subdomain = parts[0]
    }
  } else {
    // For production domains like test.craftopia.work
    // If it has 3 or more parts (sub.domain.tld), the first part is the subdomain
    if (parts.length >= 3) {
      subdomain = parts[0]
    }
  }

  // Critical Debug Log
  console.log(`[Middleware] Host: ${hostname} (Orig: ${originalHost}, Fwd: ${forwardedHost}) | Subdomain: ${subdomain} | Path: ${path}`)

  // 4. Skip internal / system / common paths
  if (
    path.startsWith('/api') || 
    path.startsWith('/_next') || 
    path.startsWith('/sites') || 
    path.startsWith('/uploads') ||
    path === '/favicon.ico' ||
    path.startsWith('/adminpage')
  ) {
    return NextResponse.next()
  }

  // Define excluded subdomains
  const excludedSubdomains = ['www', 'api', 'admin', 'dashboard']

  // Handle /login specifically: Always redirect to main domain if on a subdomain
  if (path === '/login') {
    if (subdomain && !excludedSubdomains.includes(subdomain.toLowerCase())) {
      const protocol = isLocal ? 'http' : 'https'
      const baseDomain = isLocal ? 'localhost:3000' : rootDomain
      console.log(`[Middleware] Redirecting subdomain /login to main domain: ${protocol}://${baseDomain}/login`)
      return NextResponse.redirect(`${protocol}://${baseDomain}/login`)
    }
    return NextResponse.next()
  }

  // Redirect /creators, /feed, or /explore accessed on a subdomain to the main domain /explore
  if (path === '/creators' || path === '/feed' || path === '/explore') {
    if (subdomain && !excludedSubdomains.includes(subdomain.toLowerCase())) {
      const protocol = isLocal ? 'http' : 'https'
      const baseDomain = isLocal ? 'localhost:3000' : rootDomain
      console.log(`[Middleware] Redirecting subdomain ${path} to main domain /explore: ${protocol}://${baseDomain}/explore`)
      return NextResponse.redirect(`${protocol}://${baseDomain}/explore`)
    }
  }

  // Redirect main domain /creators and /feed to /explore
  if ((path === '/creators' || path === '/feed') && (!subdomain || excludedSubdomains.includes(subdomain.toLowerCase()))) {
    const protocol = isLocal ? 'http' : 'https'
    const baseDomain = isLocal ? 'localhost:3000' : rootDomain
    console.log(`[Middleware] Redirecting legacy route ${path} to /explore: ${protocol}://${baseDomain}/explore`)
    return NextResponse.redirect(`${protocol}://${baseDomain}/explore`)
  }
  
  // 6. Subdomain Routing Logic
  if (subdomain && !excludedSubdomains.includes(subdomain.toLowerCase())) {
    
    // 6a. Legacy path redirection (e.g., /creator/test/editor -> /editor)
    if (path.startsWith('/creator/')) {
      const parts = path.split('/').filter(Boolean)
      const newPath = '/' + parts.slice(2).join('/')
      console.log(`[Middleware] Redirecting legacy path: ${path} -> ${newPath}`)
      return NextResponse.redirect(new URL(newPath, request.url))
    }

    // 6b. Rewrite to internal /sites/[site] folder
    const normalizedPath = path === '/' ? '' : path
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/sites/${subdomain}${normalizedPath}`
    
    return NextResponse.rewrite(rewriteUrl)
  }

  // 7. Handle WWW or Root
  if (subdomain === 'www') {
    console.log(`[Middleware] WWW detected, serving root page`)
    return NextResponse.rewrite(new URL(path, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

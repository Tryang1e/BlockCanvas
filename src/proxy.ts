import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Next.js 16: `middleware` 컨벤션이 deprecated 되어 `proxy`로 이관됨.
// 서브도메인({creator}.craftopia.work) → /sites/[site] 리라이트 및 레거시 경로 리다이렉트를 담당한다.
export function proxy(request: NextRequest) {
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

  // 4. Skip internal / system / common paths
  if (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/sites') ||
    path.startsWith('/uploads') ||
    path.startsWith('/dynmap-proxy') || // Dynmap 리버스 프록시(next.config rewrites)는 서브도메인 라우팅 우회
    path === '/favicon.ico' ||
    path.startsWith('/adminpage')
  ) {
    return NextResponse.next()
  }

  // 4b. auth.craftopia.work → 연동 허브(/auth). (/api/* 는 위에서 이미 통과 처리됨)
  if (subdomain.toLowerCase() === 'auth') {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/auth'
    return NextResponse.rewrite(rewriteUrl)
  }

  // Define excluded subdomains
  const excludedSubdomains = ['www', 'api', 'admin', 'dashboard']

  // Handle /login specifically: Always redirect to main domain if on a subdomain
  if (path === '/login') {
    if (subdomain && !excludedSubdomains.includes(subdomain.toLowerCase())) {
      const protocol = isLocal ? 'http' : 'https'
      const baseDomain = isLocal ? 'localhost:3000' : rootDomain
      return NextResponse.redirect(`${protocol}://${baseDomain}/login`)
    }
    return NextResponse.next()
  }

  // Redirect /creators, /feed, or /explore accessed on a subdomain to the main domain /explore
  if (path === '/creators' || path === '/feed' || path === '/explore') {
    if (subdomain && !excludedSubdomains.includes(subdomain.toLowerCase())) {
      const protocol = isLocal ? 'http' : 'https'
      const baseDomain = isLocal ? 'localhost:3000' : rootDomain
      return NextResponse.redirect(`${protocol}://${baseDomain}/explore`)
    }
  }

  // Redirect main domain /creators and /feed to /explore
  if ((path === '/creators' || path === '/feed') && (!subdomain || excludedSubdomains.includes(subdomain.toLowerCase()))) {
    const protocol = isLocal ? 'http' : 'https'
    const baseDomain = isLocal ? 'localhost:3000' : rootDomain
    return NextResponse.redirect(`${protocol}://${baseDomain}/explore`)
  }

  // 6. Subdomain Routing Logic
  if (subdomain && !excludedSubdomains.includes(subdomain.toLowerCase())) {

    // 6a. Legacy path redirection (e.g., /creator/test/editor -> /editor)
    if (path.startsWith('/creator/')) {
      const segments = path.split('/').filter(Boolean)
      const newPath = '/' + segments.slice(2).join('/')
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
    return NextResponse.rewrite(new URL(path, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

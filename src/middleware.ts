import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Simple local mock auth check for MVP
  const session = request.cookies.get('session')
  const path = request.nextUrl.pathname

  // Protect /adminpage (Must be logged in to reach layout, layout will check role)
  if (path.startsWith('/adminpage')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Hide login if already logged in
  if ((path.startsWith('/login') || path.startsWith('/signup')) && session) {
    return NextResponse.redirect(new URL(`/creator/${session.value}`, request.url))
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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

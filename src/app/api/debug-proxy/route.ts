import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const parts = hostname.split('.')
  
  return NextResponse.json({
    url: request.url,
    hostname,
    parts,
    pathname: url.pathname,
    headers: Object.fromEntries(request.headers.entries()),
    cookies: Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value]))
  })
}

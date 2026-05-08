import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // Exclude routes that are implemented locally in frontend/app/api
  if (url.pathname.startsWith('/api/cctv') || url.pathname.startsWith('/api/telegram')) {
    return NextResponse.next();
  }

  // Rewrite all other /api/* requests to the backend
  if (url.pathname.startsWith('/api/')) {
    const backendUrl = new URL(url.pathname + url.search, 'https://api.capt-th.work');
    return NextResponse.rewrite(backendUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

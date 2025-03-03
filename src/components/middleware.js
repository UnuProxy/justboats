// middleware.js
import { NextResponse } from 'next/server';

// This middleware runs for API routes in Next.js
export function middleware(request) {
  // Get the pathname of the request (e.g. /api/calendar)
  const path = request.nextUrl.pathname;

  // Only run this middleware for API routes
  if (path.startsWith('/api/')) {
    // Clone the response headers
    const requestHeaders = new Headers(request.headers);
    
    // Create a new response with CORS headers
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Set CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  }

  // For non-API routes, forward the request without modification
  return NextResponse.next();
}

// Configure which paths should run the middleware
export const config = {
  matcher: '/api/:path*',
};
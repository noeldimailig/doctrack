import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for unauthenticated navigation only.
 * Better Auth explicitly documents this as NOT a security check; every page
 * and Server Action performs its own server-side session/permission check.
 */
export function proxy(request: NextRequest): NextResponse {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/documents/:path*",
    "/transmittals/:path*",
    "/activity/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/settings/:path*",
  ],
};

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDefaultRedirectForRole } from "@/lib/auth-redirect";

const sessionCookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: sessionCookieName,
    secureCookie: process.env.NODE_ENV === "production",
  });
  const { pathname } = request.nextUrl;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);

    return NextResponse.redirect(loginUrl);
  }

  const role = typeof token.role === "string" ? token.role : null;

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(
      new URL(getDefaultRedirectForRole(role), request.url),
    );
  }

  if (pathname.startsWith("/client") && role !== "CLIENT") {
    return NextResponse.redirect(
      new URL(getDefaultRedirectForRole(role), request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*"],
};

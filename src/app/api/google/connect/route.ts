import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/current-session";
import { buildGoogleConnectUrl, normalizeGoogleRedirectTo } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session?.user || session.user.role !== "CLIENT" || !session.user.tenantId) {
    return NextResponse.redirect(new URL("/login?callbackUrl=%2Fclient%2Fconnections%2Fgmail", request.url));
  }

  const url = new URL(request.url);
  const redirectTo = normalizeGoogleRedirectTo(url.searchParams.get("redirectTo"));

  try {
    const googleUrl = buildGoogleConnectUrl({
      tenantId: session.user.tenantId,
      redirectTo,
    });

    return NextResponse.redirect(googleUrl);
  } catch {
    return NextResponse.redirect(new URL(`${redirectTo}?error=google-config`, request.url));
  }
}

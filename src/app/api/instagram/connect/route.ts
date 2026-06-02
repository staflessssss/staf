import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildInstagramConnectUrl, normalizeInstagramRedirectTo } from "@/lib/instagram-oauth";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLIENT" || !session.user.tenantId) {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=%2Fclient%2Fconnections%2Finstagram", request.url),
    );
  }

  const url = new URL(request.url);
  const redirectTo = normalizeInstagramRedirectTo(url.searchParams.get("redirectTo"));

  try {
    const instagramUrl = buildInstagramConnectUrl({
      tenantId: session.user.tenantId,
      redirectTo,
    });

    return NextResponse.redirect(instagramUrl);
  } catch {
    return NextResponse.redirect(new URL(`${redirectTo}?error=instagram-config`, request.url));
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(64).optional(),
  timezone: z.string().trim().min(2).max(100).default("UTC"),
});

export async function GET() {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const items = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json().catch(() => null);
  const parsed = createTenantSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tenant payload." }, { status: 400 });
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);

  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  const tenant = await db.tenant.create({
    data: {
      name: parsed.data.name,
      slug,
      timezone: parsed.data.timezone,
    },
  });

  return NextResponse.json({ item: tenant }, { status: 201 });
}

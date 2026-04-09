import { NextResponse } from "next/server";
import { ConnectionStatus, IntegrationType } from "@prisma/client";
import { google } from "googleapis";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { createGoogleOAuthClientFromEncryptedCredentials } from "@/lib/google-api-client";

type RouteContext = {
  params: Promise<{ tenantId: string; integrationId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId, integrationId } = await context.params;
  const integration = await db.integrationConnection.findFirst({
    where: {
      id: integrationId,
      tenantId,
      type: IntegrationType.GOOGLE_SHEETS,
      status: ConnectionStatus.CONNECTED,
    },
    select: {
      credentialsEnc: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Connected Google Sheets integration not found." }, { status: 404 });
  }

  try {
    const auth = createGoogleOAuthClientFromEncryptedCredentials(integration.credentialsEnc);
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      pageSize: 50,
      orderBy: "viewedByMeTime desc,name_natural",
      fields: "files(id,name,modifiedTime,webViewLink)",
    });

    return NextResponse.json({
      items:
        response.data.files?.map((file) => ({
          id: file.id ?? "",
          name: file.name ?? "Untitled spreadsheet",
          modifiedTime: file.modifiedTime ?? null,
          webViewLink: file.webViewLink ?? null,
        })) ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Google spreadsheets.",
      },
      { status: 400 },
    );
  }
}

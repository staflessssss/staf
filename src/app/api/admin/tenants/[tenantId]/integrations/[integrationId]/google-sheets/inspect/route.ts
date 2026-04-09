import { NextResponse } from "next/server";
import { IntegrationType } from "@prisma/client";
import { google } from "googleapis";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import {
  createGoogleOAuthClientFromEncryptedCredentials,
  parseSpreadsheetId,
} from "@/lib/google-api-client";

type RouteContext = {
  params: Promise<{ tenantId: string; integrationId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId, integrationId } = await context.params;
  const url = new URL(request.url);
  const spreadsheetId = parseSpreadsheetId(url.searchParams.get("spreadsheetId") ?? "");

  if (!spreadsheetId) {
    return NextResponse.json({ error: "Spreadsheet ID is required." }, { status: 400 });
  }

  const integration = await db.integrationConnection.findFirst({
    where: {
      id: integrationId,
      tenantId,
      type: IntegrationType.GOOGLE_SHEETS,
      status: "CONNECTED",
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
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets(properties(sheetId,title,index))",
    });

    return NextResponse.json({
      item: {
        spreadsheetId,
        title: response.data.properties?.title ?? "Untitled spreadsheet",
        sheets:
          response.data.sheets?.map((sheet) => ({
            id: String(sheet.properties?.sheetId ?? ""),
            title: sheet.properties?.title ?? "Sheet",
            index: sheet.properties?.index ?? 0,
          })) ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not inspect this spreadsheet.",
      },
      { status: 400 },
    );
  }
}

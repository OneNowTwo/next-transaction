import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { runLiveIngestIfEmpty } from "@/lib/ingestion/bootstrap";
import { runAllConnectors, runConnector } from "@/lib/ingestion/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth =
    request.headers.get("authorization") ||
    request.headers.get("x-cron-secret");
  if (!verifyCronSecret(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "if-empty") {
    const result = await runLiveIngestIfEmpty();
    return NextResponse.json({ ok: true, result, at: new Date().toISOString() });
  }

  const key = request.nextUrl.searchParams.get("connector");
  const result = key ? await runConnector(key) : await runAllConnectors();
  return NextResponse.json({ ok: true, result, at: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

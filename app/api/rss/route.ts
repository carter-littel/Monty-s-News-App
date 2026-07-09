import { NextResponse } from "next/server";
import { ingestFeeds } from "@/lib/ingest";

export const runtime = "nodejs";

export async function GET() {
  const payload = await ingestFeeds();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
    },
  });
}

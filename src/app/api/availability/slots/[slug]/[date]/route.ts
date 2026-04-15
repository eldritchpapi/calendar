import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAvailableSlots } from "@/lib/availability";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; date: string }> }
) {
  const { slug, date } = await params;
  const tz =
    request.nextUrl.searchParams.get("tz") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const eventType = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.slug, slug))
    .get();

  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  const slots = await getAvailableSlots(eventType.id, date, tz);

  // CORS for embedding
  return NextResponse.json(
    { slots, eventType: { name: eventType.name, duration: eventType.duration } },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    }
  );
}

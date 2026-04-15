import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const eventType = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.slug, slug))
    .get();

  if (!eventType || !eventType.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(eventType, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}

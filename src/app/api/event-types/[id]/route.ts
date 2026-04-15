import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventType = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.id, id))
    .get();

  if (!eventType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(eventType);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  await db.update(eventTypes)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(eventTypes.id, id))
    .run();

  const updated = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.id, id))
    .get();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(eventTypes).where(eq(eventTypes.id, id)).run();
  return NextResponse.json({ success: true });
}

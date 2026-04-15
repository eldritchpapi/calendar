import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const all = await db.select().from(settings).all();
  const obj: Record<string, string> = {};
  for (const s of all) {
    obj[s.key] = s.value;
  }
  return NextResponse.json(obj);
}

export async function PUT(request: NextRequest) {
  const body: Record<string, string> = await request.json();

  for (const [key, value] of Object.entries(body)) {
    if (!value && value !== "") continue;
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .get();

    if (existing) {
      await db.update(settings)
        .set({ value })
        .where(eq(settings.key, key))
        .run();
    } else {
      await db.insert(settings).values({ key, value }).run();
    }
  }

  return NextResponse.json({ success: true });
}

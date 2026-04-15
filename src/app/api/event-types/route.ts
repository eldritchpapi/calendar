import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  duration: z.number().min(5).max(480),
  location: z.string().optional(),
  locationType: z.string().optional(),
  color: z.string().optional(),
  availabilityScheduleId: z.string().optional(),
  bufferBefore: z.number().optional(),
  bufferAfter: z.number().optional(),
  maxPerDay: z.number().optional().nullable(),
  minNotice: z.number().optional(),
  maxFutureDays: z.number().optional(),
  customFields: z.string().optional(),
  isActive: z.boolean().optional(),
  price: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().optional(),
  priceLabel: z.string().optional(),
});

export async function GET() {
  const types = await db.select().from(eventTypes).all();
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = createSchema.parse(body);

  // Check slug uniqueness
  const existing = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.slug, data.slug))
    .get();
  if (existing) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
  }

  const id = uuid();
  await db.insert(eventTypes)
    .values({
      id,
      ...data,
    })
    .run();

  const created = await db.select().from(eventTypes).where(eq(eventTypes.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}

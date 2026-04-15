import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { availabilitySchedules, availabilityRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().default("America/New_York"),
  isDefault: z.boolean().optional(),
  rules: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
      })
    )
    .optional(),
});

export async function GET() {
  const schedules = await db.select().from(availabilitySchedules).all();
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = createSchema.parse(body);

  const id = uuid();

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await db.update(availabilitySchedules)
      .set({ isDefault: false })
      .run();
  }

  await db.insert(availabilitySchedules)
    .values({
      id,
      name: data.name,
      timezone: data.timezone,
      isDefault: data.isDefault ?? false,
    })
    .run();

  // Insert rules if provided
  if (data.rules) {
    for (const rule of data.rules) {
      await db.insert(availabilityRules)
        .values({
          id: uuid(),
          scheduleId: id,
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
        })
        .run();
    }
  }

  const created = await db
    .select()
    .from(availabilitySchedules)
    .where(eq(availabilitySchedules.id, id))
    .get();
  return NextResponse.json(created, { status: 201 });
}

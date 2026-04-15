import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  availabilitySchedules,
  availabilityRules,
  dateOverrides,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const schedule = await db
    .select()
    .from(availabilitySchedules)
    .where(eq(availabilitySchedules.id, id))
    .get();

  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.scheduleId, id))
    .all();

  const overrides = await db
    .select()
    .from(dateOverrides)
    .where(eq(dateOverrides.scheduleId, id))
    .all();

  return NextResponse.json({ ...schedule, rules, overrides });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Update schedule
  await db.update(availabilitySchedules)
    .set({
      name: body.name,
      timezone: body.timezone,
      isDefault: body.isDefault,
    })
    .where(eq(availabilitySchedules.id, id))
    .run();

  // Replace rules
  if (body.rules) {
    await db.delete(availabilityRules)
      .where(eq(availabilityRules.scheduleId, id))
      .run();

    for (const rule of body.rules) {
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

  // Replace overrides
  if (body.overrides) {
    await db.delete(dateOverrides)
      .where(eq(dateOverrides.scheduleId, id))
      .run();

    for (const override of body.overrides) {
      await db.insert(dateOverrides)
        .values({
          id: uuid(),
          scheduleId: id,
          date: override.date,
          isBlocked: override.isBlocked,
          startTime: override.startTime,
          endTime: override.endTime,
        })
        .run();
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(availabilitySchedules)
    .where(eq(availabilitySchedules.id, id))
    .run();
  return NextResponse.json({ success: true });
}

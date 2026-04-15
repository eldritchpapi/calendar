import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workflows, workflowSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workflow = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .get();

  if (!workflow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const steps = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowId, id))
    .all();

  return NextResponse.json({ ...workflow, steps });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.trigger !== undefined) updates.trigger = body.trigger;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.eventTypeId !== undefined) updates.eventTypeId = body.eventTypeId;

  if (Object.keys(updates).length > 0) {
    await db.update(workflows).set(updates).where(eq(workflows.id, id)).run();
  }

  if (body.steps) {
    await db.delete(workflowSteps)
      .where(eq(workflowSteps.workflowId, id))
      .run();

    for (const step of body.steps) {
      await db.insert(workflowSteps)
        .values({
          id: uuid(),
          workflowId: id,
          stepOrder: step.stepOrder ?? 0,
          action: step.action ?? "send_email",
          delayMinutes: step.delayMinutes ?? 0,
          emailSubject: step.emailSubject ?? "",
          emailBody: step.emailBody ?? "",
          recipientType: step.recipientType ?? "invitee",
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
  await db.delete(workflows).where(eq(workflows.id, id)).run();
  return NextResponse.json({ success: true });
}

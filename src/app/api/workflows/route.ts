import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workflows, workflowSteps } from "@/db/schema";
import { v4 as uuid } from "uuid";

export async function GET() {
  const all = await db.select().from(workflows).all();
  return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const id = uuid();

  await db.insert(workflows)
    .values({
      id,
      name: body.name,
      trigger: body.trigger,
      eventTypeId: body.eventTypeId || null,
      isActive: true,
    })
    .run();

  if (body.steps) {
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

  return NextResponse.json({ id }, { status: 201 });
}

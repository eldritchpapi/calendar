import { db } from "@/db";
import {
  workflows,
  workflowSteps,
  workflowExecutions,
  bookings,
  contacts,
  settings,
} from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { addMinutes, parseISO, format } from "date-fns";
import { sendEmail, renderTemplate } from "./email";

async function getSetting(key: string): Promise<string> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row?.value ?? "";
}

export async function scheduleWorkflowsForBooking(
  bookingId: string,
  trigger: "booking_created" | "booking_cancelled"
) {
  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();
  if (!booking) return;

  const activeWorkflows = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.trigger, trigger),
        eq(workflows.isActive, true)
      )
    )
    .all();

  for (const workflow of activeWorkflows) {
    // If workflow is scoped to an event type, check it matches
    if (
      workflow.eventTypeId &&
      workflow.eventTypeId !== booking.eventTypeId
    ) {
      continue;
    }

    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, workflow.id))
      .all();

    for (const step of steps) {
      let scheduledFor: Date;
      const delay = step.delayMinutes ?? 0;

      if (delay === 0) {
        scheduledFor = new Date();
      } else if (delay > 0) {
        scheduledFor = addMinutes(new Date(), delay);
      } else {
        // Negative = before meeting
        scheduledFor = addMinutes(parseISO(booking.startTime), delay);
      }

      await db.insert(workflowExecutions)
        .values({
          id: uuid(),
          workflowStepId: step.id,
          bookingId: booking.id,
          scheduledFor: scheduledFor.toISOString(),
          status: "pending",
        })
        .run();
    }
  }

  // Also handle before/after meeting triggers
  if (trigger === "booking_created") {
    const beforeWorkflows = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.trigger, "before_meeting"),
          eq(workflows.isActive, true)
        )
      )
      .all();

    const afterWorkflows = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.trigger, "after_meeting"),
          eq(workflows.isActive, true)
        )
      )
      .all();

    for (const workflow of [...beforeWorkflows, ...afterWorkflows]) {
      if (
        workflow.eventTypeId &&
        workflow.eventTypeId !== booking.eventTypeId
      ) {
        continue;
      }

      const steps = await db
        .select()
        .from(workflowSteps)
        .where(eq(workflowSteps.workflowId, workflow.id))
        .all();

      for (const step of steps) {
        const baseTime =
          workflow.trigger === "before_meeting"
            ? parseISO(booking.startTime)
            : parseISO(booking.endTime);
        const scheduledFor = addMinutes(baseTime, step.delayMinutes ?? 0);

        await db.insert(workflowExecutions)
          .values({
            id: uuid(),
            workflowStepId: step.id,
            bookingId: booking.id,
            scheduledFor: scheduledFor.toISOString(),
            status: "pending",
          })
          .run();
      }
    }
  }
}

export async function cancelWorkflowsForBooking(bookingId: string) {
  await db.update(workflowExecutions)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(workflowExecutions.bookingId, bookingId),
        eq(workflowExecutions.status, "pending")
      )
    )
    .run();
}

export async function executeWorkflows() {
  const now = new Date().toISOString();
  const pending = await db
    .select({
      execution: workflowExecutions,
      step: workflowSteps,
    })
    .from(workflowExecutions)
    .innerJoin(
      workflowSteps,
      eq(workflowExecutions.workflowStepId, workflowSteps.id)
    )
    .where(
      and(
        eq(workflowExecutions.status, "pending"),
        lte(workflowExecutions.scheduledFor, now)
      )
    )
    .all();

  for (const { execution, step } of pending) {
    try {
      const booking = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, execution.bookingId))
        .get();
      if (!booking) continue;

      const contact = booking.contactId
        ? await db
            .select()
            .from(contacts)
            .where(eq(contacts.id, booking.contactId))
            .get()
        : null;

      if (!contact) continue;

      const appUrl = (await getSetting("app_url")) || "http://localhost:3000";
      const hostName = (await getSetting("host_name")) || "Calendar.io";
      const hostEmail = (await getSetting("host_email")) || "";

      const variables: Record<string, string> = {
        name: contact.name,
        email: contact.email,
        event_name: booking.title,
        date: format(parseISO(booking.startTime), "EEEE, MMMM d, yyyy"),
        time: format(parseISO(booking.startTime), "h:mm a"),
        location: booking.location || "TBD",
        cancel_link: `${appUrl}/cancel/${booking.cancellationToken}`,
        booking_link: appUrl,
        host_name: hostName,
      };

      const subject = renderTemplate(step.emailSubject || "", variables);
      const html = renderTemplate(step.emailBody || "", variables);

      const recipients: string[] = [];
      if (step.recipientType === "invitee" || step.recipientType === "both") {
        recipients.push(contact.email);
      }
      if (
        (step.recipientType === "host" || step.recipientType === "both") &&
        hostEmail
      ) {
        recipients.push(hostEmail);
      }

      for (const to of recipients) {
        await sendEmail({ to, subject, html });
      }

      await db.update(workflowExecutions)
        .set({ status: "sent", executedAt: new Date().toISOString() })
        .where(eq(workflowExecutions.id, execution.id))
        .run();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await db.update(workflowExecutions)
        .set({ status: "failed", error: errMsg })
        .where(eq(workflowExecutions.id, execution.id))
        .run();
    }
  }
}

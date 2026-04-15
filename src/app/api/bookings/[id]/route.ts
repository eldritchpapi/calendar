import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteCalendarEvent } from "@/lib/ical-sync";
import { scheduleWorkflowsForBooking, cancelWorkflowsForBooking, executeWorkflows } from "@/lib/workflows";
import { sendCancellationNotice } from "@/lib/booking-emails";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .get();

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(booking);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .get();

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If cancelling, remove from iCal, send notices, handle workflows
  if (body.status === "cancelled") {
    // Cancel pending workflow executions
    await cancelWorkflowsForBooking(id);

    // Send cancellation notices to invitee + host (always fires)
    try {
      await sendCancellationNotice(id);
    } catch (error) {
      console.error("Cancellation email failed:", error);
    }

    // Schedule cancellation workflows
    try {
      await scheduleWorkflowsForBooking(id, "booking_cancelled");
      await executeWorkflows();
    } catch (error) {
      console.error("Cancellation workflow failed:", error);
    }

    // Remove from iCal
    if (booking.icalEventId) {
      try {
        await deleteCalendarEvent(booking.icalEventId);
      } catch (error) {
        console.error("Failed to delete iCal event:", error);
      }
    }
  }

  await db.update(bookings)
    .set({
      ...body,
      ...(body.status === "cancelled"
        ? { cancelledAt: new Date().toISOString() }
        : {}),
    })
    .where(eq(bookings.id, id))
    .run();

  const updated = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .get();
  return NextResponse.json(updated);
}

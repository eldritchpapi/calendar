import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, eventTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteCalendarEvent } from "@/lib/ical-sync";
import {
  cancelWorkflowsForBooking,
  scheduleWorkflowsForBooking,
  executeWorkflows,
} from "@/lib/workflows";
import { sendCancellationNotice } from "@/lib/booking-emails";

// Public endpoint — cancel a booking via its cancellation token.
// No auth required; the token is the secret.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const result = await db
    .select({ booking: bookings, eventType: eventTypes })
    .from(bookings)
    .leftJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(eq(bookings.cancellationToken, token))
    .get();

  if (!result) {
    return NextResponse.json(
      { error: "Invalid or expired cancellation link" },
      { status: 404 }
    );
  }

  return NextResponse.json(result, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.cancellationToken, token))
    .get();

  if (!booking) {
    return NextResponse.json(
      { error: "Invalid cancellation link" },
      { status: 404 }
    );
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "This booking is already cancelled" },
      { status: 400 }
    );
  }

  // Cancel pending workflow executions
  await cancelWorkflowsForBooking(booking.id);

  // Send cancellation notices
  try {
    await sendCancellationNotice(booking.id);
  } catch (error) {
    console.error("Cancellation email failed:", error);
  }

  // Schedule cancellation workflows
  try {
    await scheduleWorkflowsForBooking(booking.id, "booking_cancelled");
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

  // Update booking
  await db.update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    })
    .where(eq(bookings.id, booking.id))
    .run();

  return NextResponse.json(
    { success: true },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

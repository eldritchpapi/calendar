import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";

// Public — invitees look up their booking after Stripe redirect.
// Returns only non-sensitive fields.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.stripeSessionId, sessionId))
    .get();

  if (!booking) {
    return NextResponse.json({ booking: null }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  return NextResponse.json(
    {
      booking: {
        id: booking.id,
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: booking.location,
        cancellationToken: booking.cancellationToken,
        amountPaid: booking.amountPaid,
      },
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

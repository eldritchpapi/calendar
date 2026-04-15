import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, contacts, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildICS } from "@/lib/booking-emails";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const booking = await db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contact = booking.contactId
    ? await db.select().from(contacts).where(eq(contacts.id, booking.contactId)).get()
    : null;

  const hostEmailRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "host_email"))
    .get();

  const ics = await buildICS(
    booking,
    contact?.email || "",
    hostEmailRow?.value || ""
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking.ics"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, contacts, eventTypes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { addMinutes, parseISO } from "date-fns";
import { createCalendarEvent } from "@/lib/ical-sync";
import { scheduleWorkflowsForBooking, executeWorkflows } from "@/lib/workflows";
import { sendBookingConfirmation } from "@/lib/booking-emails";

const bookingSchema = z.object({
  eventTypeSlug: z.string(),
  startTime: z.string(),
  timezone: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  customFieldData: z.record(z.string(), z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const upcoming = request.nextUrl.searchParams.get("upcoming");

  const query = db
    .select({
      booking: bookings,
      eventType: eventTypes,
      contact: contacts,
    })
    .from(bookings)
    .leftJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .leftJoin(contacts, eq(bookings.contactId, contacts.id));

  const results = await query.orderBy(desc(bookings.startTime)).all();

  let filtered = results;
  if (status) {
    filtered = filtered.filter((r) => r.booking.status === status);
  }
  if (upcoming === "true") {
    const now = new Date().toISOString();
    filtered = filtered.filter((r) => r.booking.startTime >= now);
  }

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = bookingSchema.parse(body);

  // Find event type
  const eventType = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.slug, data.eventTypeSlug))
    .get();

  if (!eventType || !eventType.isActive) {
    return NextResponse.json(
      { error: "Event type not found or inactive" },
      { status: 404 }
    );
  }

  const startTime = parseISO(data.startTime);
  const endTime = addMinutes(startTime, eventType.duration);

  // Upsert contact
  let contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.email, data.email))
    .get();

  if (!contact) {
    const contactId = uuid();
    await db.insert(contacts)
      .values({
        id: contactId,
        email: data.email,
        name: data.name,
        phone: data.phone || null,
        company: data.company || null,
        totalBookings: 1,
        lastBookedAt: new Date().toISOString(),
      })
      .run();
    contact = (await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get())!;
  } else {
    await db.update(contacts)
      .set({
        name: data.name,
        phone: data.phone || contact.phone,
        company: data.company || contact.company,
        totalBookings: (contact.totalBookings ?? 0) + 1,
        lastBookedAt: new Date().toISOString(),
      })
      .where(eq(contacts.id, contact.id))
      .run();
  }

  const bookingId = uuid();
  const cancellationToken = uuid();
  const title = `${data.name} - ${eventType.name}`;

  // Create iCal event
  let icalEventId: string | null = null;
  try {
    icalEventId = await createCalendarEvent({
      title,
      startDate: startTime.toISOString(),
      endDate: endTime.toISOString(),
      location: eventType.location || undefined,
      notes: `Booked via Calendar.io\nEmail: ${data.email}${data.notes ? `\nNotes: ${data.notes}` : ""}`,
    });
  } catch (error) {
    console.error("iCal sync failed:", error);
  }

  await db.insert(bookings)
    .values({
      id: bookingId,
      eventTypeId: eventType.id,
      contactId: contact.id,
      title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      timezone: data.timezone,
      status: "confirmed",
      location: eventType.location,
      notes: data.notes || null,
      customFieldData: data.customFieldData
        ? JSON.stringify(data.customFieldData)
        : null,
      cancellationToken,
      icalEventId,
    })
    .run();

  const booking = (await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get())!;

  // Send confirmation to invitee + notification to host (always fires, regardless of workflows)
  try {
    await sendBookingConfirmation({ bookingId, cancellationToken });
  } catch (error) {
    console.error("Confirmation email failed:", error);
  }

  // Trigger user-configured workflow automations
  try {
    await scheduleWorkflowsForBooking(bookingId, "booking_created");
    // Execute any immediate workflows (delayMinutes === 0)
    await executeWorkflows();
  } catch (error) {
    console.error("Workflow scheduling failed:", error);
  }

  return NextResponse.json(
    { booking, cancellationToken },
    {
      status: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

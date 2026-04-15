import { db } from "@/db";
import {
  availabilitySchedules,
  availabilityRules,
  dateOverrides,
  bookings,
  eventTypes,
} from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  format,
  addMinutes,
  parseISO,
  isBefore,
  startOfDay,
  endOfDay,
  isAfter,
  addDays,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getCalendarEvents } from "./ical-sync";

export interface TimeSlot {
  start: string; // ISO 8601
  end: string;
  startLocal: string; // HH:mm in invitee tz
}

export async function getAvailableSlots(
  eventTypeId: string,
  dateStr: string, // YYYY-MM-DD
  inviteeTz: string
): Promise<TimeSlot[]> {
  const eventType = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.id, eventTypeId))
    .get();
  if (!eventType || !eventType.isActive) return [];

  const scheduleId = eventType.availabilityScheduleId;
  if (!scheduleId) return [];

  const schedule = await db
    .select()
    .from(availabilitySchedules)
    .where(eq(availabilitySchedules.id, scheduleId))
    .get();
  if (!schedule) return [];

  const hostTz = schedule.timezone;

  // Check date override first
  const override = await db
    .select()
    .from(dateOverrides)
    .where(
      and(eq(dateOverrides.scheduleId, scheduleId), eq(dateOverrides.date, dateStr))
    )
    .get();

  if (override?.isBlocked) return [];

  // Get availability windows for this date
  let windows: { start: string; end: string }[] = [];

  if (override && override.startTime && override.endTime) {
    windows = [{ start: override.startTime, end: override.endTime }];
  } else {
    // Get day-of-week rules
    const dateObj = parseISO(dateStr);
    const dayOfWeek = dateObj.getDay();
    const rules = await db
      .select()
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.scheduleId, scheduleId),
          eq(availabilityRules.dayOfWeek, dayOfWeek)
        )
      )
      .all();
    windows = rules.map((r) => ({ start: r.startTime, end: r.endTime }));
  }

  if (windows.length === 0) return [];

  // Generate candidate slots
  const candidates: { start: Date; end: Date }[] = [];
  for (const window of windows) {
    const [startH, startM] = window.start.split(":").map(Number);
    const [endH, endM] = window.end.split(":").map(Number);

    // Create times in host timezone
    const windowStart = fromZonedTime(
      new Date(`${dateStr}T${window.start}:00`),
      hostTz
    );
    const windowEnd = fromZonedTime(
      new Date(`${dateStr}T${window.end}:00`),
      hostTz
    );

    let slotStart = windowStart;
    while (true) {
      const slotEnd = addMinutes(slotStart, eventType.duration);
      if (isAfter(slotEnd, windowEnd)) break;
      candidates.push({ start: slotStart, end: slotEnd });
      slotStart = addMinutes(slotStart, eventType.duration);
    }
  }

  if (candidates.length === 0) return [];

  // Get existing bookings for conflict check
  const dayStart = startOfDay(
    fromZonedTime(new Date(`${dateStr}T00:00:00`), hostTz)
  );
  const dayEnd = endOfDay(
    fromZonedTime(new Date(`${dateStr}T23:59:59`), hostTz)
  );

  const existingBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        gte(bookings.startTime, dayStart.toISOString()),
        lte(bookings.startTime, dayEnd.toISOString()),
        eq(bookings.status, "confirmed")
      )
    )
    .all();

  // Get iCal events for conflict check
  let icalEvents: { startDate: string; endDate: string }[] = [];
  try {
    icalEvents = await getCalendarEvents(
      dayStart.toISOString(),
      dayEnd.toISOString()
    );
  } catch {
    // Continue without iCal if unavailable
  }

  // Filter out conflicting slots
  const now = new Date();
  const minNoticeTime = addMinutes(now, eventType.minNotice ?? 60);
  const maxFutureDate = addDays(now, eventType.maxFutureDays ?? 60);

  // Count bookings for maxPerDay
  const todayBookingCount = existingBookings.filter(
    (b) => b.eventTypeId === eventTypeId
  ).length;

  const available = candidates.filter((slot) => {
    // Min notice check
    if (isBefore(slot.start, minNoticeTime)) return false;

    // Max future days check
    if (isAfter(slot.start, maxFutureDate)) return false;

    // Max per day check
    if (eventType.maxPerDay && todayBookingCount >= eventType.maxPerDay)
      return false;

    // Booking conflict check (including buffers)
    const bufferBefore = eventType.bufferBefore ?? 0;
    const bufferAfter = eventType.bufferAfter ?? 0;
    const slotWithBuffer = {
      start: addMinutes(slot.start, -bufferBefore),
      end: addMinutes(slot.end, bufferAfter),
    };

    for (const booking of existingBookings) {
      const bStart = parseISO(booking.startTime);
      const bEnd = parseISO(booking.endTime);
      if (
        isBefore(slotWithBuffer.start, bEnd) &&
        isAfter(slotWithBuffer.end, bStart)
      ) {
        return false;
      }
    }

    // iCal conflict check
    for (const event of icalEvents) {
      const eStart = parseISO(event.startDate);
      const eEnd = parseISO(event.endDate);
      if (isBefore(slot.start, eEnd) && isAfter(slot.end, eStart)) {
        return false;
      }
    }

    return true;
  });

  // Convert to invitee timezone for display
  return available.map((slot) => {
    const zonedStart = toZonedTime(slot.start, inviteeTz);
    return {
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      startLocal: format(zonedStart, "HH:mm"),
    };
  });
}

export function getAvailableDates(
  eventTypeId: string,
  startDate: string,
  endDate: string,
  inviteeTz: string
): Promise<string[]> {
  // Returns dates that have at least one available slot
  const dates: string[] = [];
  let current = parseISO(startDate);
  const end = parseISO(endDate);

  const promises: Promise<void>[] = [];
  while (!isAfter(current, end)) {
    const dateStr = format(current, "yyyy-MM-dd");
    promises.push(
      getAvailableSlots(eventTypeId, dateStr, inviteeTz).then((slots) => {
        if (slots.length > 0) dates.push(dateStr);
      })
    );
    current = addDays(current, 1);
  }

  return Promise.all(promises).then(() => dates.sort());
}

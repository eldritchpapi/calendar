import { google, calendar_v3 } from "googleapis";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  } else {
    await db.insert(settings).values({ key, value }).run();
  }
}

/**
 * Build an OAuth2 client. Credentials come from env vars.
 */
export function oauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate the URL the admin should visit to authorize Calendar access.
 */
export function getAuthUrl(): string {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token on every consent
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
}

/**
 * Exchange the auth code for tokens and persist them.
 */
export async function handleCallback(code: string): Promise<void> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);

  if (tokens.access_token) {
    await setSetting("google_access_token", tokens.access_token);
  }
  if (tokens.refresh_token) {
    await setSetting("google_refresh_token", tokens.refresh_token);
  }
  if (tokens.expiry_date) {
    await setSetting("google_token_expiry", String(tokens.expiry_date));
  }
  if (tokens.scope) {
    await setSetting("google_token_scope", tokens.scope);
  }
}

/**
 * Returns a configured Calendar API client, or null if not connected.
 * Handles token refresh automatically.
 */
async function getCalendarClient(): Promise<calendar_v3.Calendar | null> {
  const accessToken = await getSetting("google_access_token");
  const refreshToken = await getSetting("google_refresh_token");

  if (!accessToken && !refreshToken) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: accessToken ?? undefined,
    refresh_token: refreshToken ?? undefined,
  });

  // Persist newly-refreshed tokens
  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await setSetting("google_access_token", tokens.access_token);
    }
    if (tokens.refresh_token) {
      await setSetting("google_refresh_token", tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      await setSetting("google_token_expiry", String(tokens.expiry_date));
    }
  });

  return google.calendar({ version: "v3", auth: client });
}

export async function isConnected(): Promise<boolean> {
  const refreshToken = await getSetting("google_refresh_token");
  return !!refreshToken;
}

export async function disconnect(): Promise<void> {
  await setSetting("google_access_token", "");
  await setSetting("google_refresh_token", "");
  await setSetting("google_token_expiry", "");
}

// ============================================================================
// Public API — matches the old ical-sync interface so callers don't change
// ============================================================================

export interface CalendarEvent {
  uid: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendar?: string;
}

// In-memory cache
const eventCache: Map<string, CalendarEvent[]> = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * List all calendars the authorized user has access to.
 * Returns id + summary. IDs are used internally; summaries are shown in UI.
 */
export async function listAllCalendars(): Promise<
  Array<{ id: string; summary: string; primary?: boolean }>
> {
  const cal = await getCalendarClient();
  if (!cal) return [];

  try {
    const res = await cal.calendarList.list({ maxResults: 250 });
    return (res.data.items ?? [])
      .filter((c) => c.id && c.summary)
      .map((c) => ({
        id: c.id!,
        summary: c.summary!,
        primary: c.primary ?? false,
      }));
  } catch (error) {
    console.error("Failed to list calendars:", error);
    return [];
  }
}

/**
 * Read events across all selected calendars within the time range.
 * Returns a merged list with each event tagged by its source calendar.
 */
export async function getCalendarEvents(
  startISO: string,
  endISO: string
): Promise<CalendarEvent[]> {
  const cacheKey = `${startISO}_${endISO}`;
  if (Date.now() - lastCacheUpdate < CACHE_TTL && eventCache.has(cacheKey)) {
    return eventCache.get(cacheKey)!;
  }

  const cal = await getCalendarClient();
  if (!cal) return [];

  const calendarIds = await getSyncCalendarIds();
  if (calendarIds.length === 0) return [];

  const results = await Promise.allSettled(
    calendarIds.map(async (calendarId) => {
      const res = await cal.events.list({
        calendarId,
        timeMin: startISO,
        timeMax: endISO,
        singleEvents: true,
        showDeleted: false,
        maxResults: 2500,
      });
      const events = res.data.items ?? [];
      return events
        .filter((e) => e.start && e.end)
        .map<CalendarEvent>((e) => ({
          uid: e.id ?? "",
          title: e.summary ?? "(Busy)",
          startDate: e.start!.dateTime ?? `${e.start!.date}T00:00:00.000Z`,
          endDate: e.end!.dateTime ?? `${e.end!.date}T00:00:00.000Z`,
          allDay: !e.start!.dateTime,
          calendar: calendarId,
        }));
    })
  );

  const allEvents: CalendarEvent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allEvents.push(...r.value);
    else console.error("Calendar fetch failed:", r.reason);
  }

  eventCache.set(cacheKey, allEvents);
  lastCacheUpdate = Date.now();
  return allEvents;
}

export async function createCalendarEvent(event: {
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
}): Promise<string | null> {
  const cal = await getCalendarClient();
  if (!cal) return null;

  const calendarId = (await getSetting("google_primary_calendar")) || "primary";

  try {
    const res = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: event.title,
        description: event.notes,
        location: event.location,
        start: { dateTime: event.startDate },
        end: { dateTime: event.endDate },
      },
    });
    eventCache.clear();
    lastCacheUpdate = 0;
    return res.data.id ?? null;
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const cal = await getCalendarClient();
  if (!cal) return false;

  const calendarId = (await getSetting("google_primary_calendar")) || "primary";

  try {
    await cal.events.delete({ calendarId, eventId });
    eventCache.clear();
    lastCacheUpdate = 0;
    return true;
  } catch (error) {
    console.error("Failed to delete calendar event:", error);
    return false;
  }
}

/**
 * Return the calendar IDs to check for conflicts. If none configured,
 * defaults to the primary calendar.
 */
async function getSyncCalendarIds(): Promise<string[]> {
  const raw = await getSetting("google_sync_calendars");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }
  // Fallback: read the primary calendar only
  return ["primary"];
}

export function clearCache() {
  eventCache.clear();
  lastCacheUpdate = 0;
}

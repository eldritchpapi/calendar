import { db } from "@/db";
import { bookings, eventTypes, contacts } from "@/db/schema";
import { eq, gte, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date().toISOString();

  const upcomingMeetings = await db
    .select({
      booking: bookings,
      eventType: eventTypes,
    })
    .from(bookings)
    .leftJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(gte(bookings.startTime, now))
    .orderBy(bookings.startTime)
    .limit(10)
    .all();

  const [totalBookings] = await db.select({ count: count() }).from(bookings).all();
  const [totalContacts] = await db.select({ count: count() }).from(contacts).all();
  const [totalEventTypes] = await db.select({ count: count() }).from(eventTypes).all();
  const [upcomingCount] = await db
    .select({ count: count() })
    .from(bookings)
    .where(gte(bookings.startTime, now))
    .all();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to Calendar.io
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-primary">{upcomingCount.count}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalBookings.count}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Event Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalEventTypes.count}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalContacts.count}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingMeetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No upcoming meetings</p>
              <p className="text-sm mt-1">
                Bookings will appear here once invitees schedule time with you.
              </p>
              <Link
                href="/event-types"
                className="text-primary hover:underline text-sm mt-4 inline-block"
              >
                Create an event type to get started
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map(({ booking, eventType }) => (
                <Link
                  key={booking.id}
                  href={`/meetings/${booking.id}`}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div
                    className="w-1 h-12 rounded-full"
                    style={{ backgroundColor: eventType?.color || "#3B82F6" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{booking.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(booking.startTime), "EEE, MMM d 'at' h:mm a")}
                      {" - "}
                      {format(parseISO(booking.endTime), "h:mm a")}
                    </p>
                  </div>
                  <Badge
                    variant={
                      booking.status === "confirmed" ? "default" : "secondary"
                    }
                  >
                    {booking.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

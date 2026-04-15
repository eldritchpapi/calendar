"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, isPast } from "date-fns";

interface MeetingData {
  booking: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    location: string | null;
    notes: string | null;
    timezone: string;
  };
  eventType: {
    name: string;
    color: string;
    duration: number;
  } | null;
  contact: {
    name: string;
    email: string;
  } | null;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then(setMeetings)
      .finally(() => setLoading(false));
  }, []);

  const cancelBooking = async (id: string) => {
    if (!confirm("Cancel this meeting?")) return;
    await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setMeetings((prev) =>
      prev.map((m) =>
        m.booking.id === id
          ? { ...m, booking: { ...m.booking, status: "cancelled" } }
          : m
      )
    );
  };

  const upcoming = meetings.filter(
    (m) => !isPast(parseISO(m.booking.endTime)) && m.booking.status === "confirmed"
  );
  const past = meetings.filter(
    (m) => isPast(parseISO(m.booking.endTime)) || m.booking.status !== "confirmed"
  );
  const displayed = tab === "upcoming" ? upcoming : past;

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
        <p className="text-muted-foreground mt-1">
          All your booked meetings
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past & Cancelled ({past.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {displayed.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No {tab} meetings
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(({ booking, eventType, contact }) => (
            <Card key={booking.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div
                  className="w-1.5 h-14 rounded-full shrink-0"
                  style={{ backgroundColor: eventType?.color || "#3B82F6" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{booking.title}</h3>
                    <Badge
                      variant={
                        booking.status === "confirmed"
                          ? "default"
                          : booking.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(booking.startTime), "EEE, MMM d 'at' h:mm a")}
                    {" - "}
                    {format(parseISO(booking.endTime), "h:mm a")}
                  </p>
                  {contact && (
                    <p className="text-sm text-muted-foreground">
                      {contact.name} ({contact.email})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {booking.status === "confirmed" &&
                    !isPast(parseISO(booking.startTime)) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => cancelBooking(booking.id)}
                      >
                        Cancel
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

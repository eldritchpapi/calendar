"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface EventType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: number;
  location: string | null;
  locationType: string | null;
  color: string;
  isActive: boolean;
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then(setEventTypes)
      .finally(() => setLoading(false));
  }, []);

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/event-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setEventTypes((prev) =>
      prev.map((et) => (et.id === id ? { ...et, isActive } : et))
    );
  };

  const deleteEventType = async (id: string) => {
    if (!confirm("Delete this event type?")) return;
    await fetch(`/api/event-types/${id}`, { method: "DELETE" });
    setEventTypes((prev) => prev.filter((et) => et.id !== id));
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Event Types</h1>
        </div>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your booking links
          </p>
        </div>
        <Link href="/event-types/new">
          <Button>+ Create</Button>
        </Link>
      </div>

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              No event types yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first event type to start accepting bookings.
            </p>
            <Link href="/event-types/new">
              <Button className="mt-4">Create event type</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {eventTypes.map((et) => (
            <Card
              key={et.id}
              className={et.isActive ? "" : "opacity-60"}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div
                  className="w-1.5 h-14 rounded-full shrink-0"
                  style={{ backgroundColor: et.color || "#3B82F6" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{et.name}</h3>
                    <Badge variant="secondary">{et.duration} min</Badge>
                    {et.locationType && (
                      <Badge variant="outline">{et.locationType}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    /book/{et.slug}
                  </p>
                  {et.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {et.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={et.isActive}
                    onCheckedChange={(checked) => toggleActive(et.id, checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(et.slug)}
                  >
                    Copy link
                  </Button>
                  <Link href={`/event-types/${et.id}`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteEventType(et.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

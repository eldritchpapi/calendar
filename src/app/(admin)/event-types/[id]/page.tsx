"use client";

import { useEffect, useState, use } from "react";
import { EventTypeForm } from "@/components/admin/event-type-form";

export default function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [eventType, setEventType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/event-types/${id}`)
      .then((r) => r.json())
      .then(setEventType)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (!eventType) return <div className="text-destructive">Event type not found</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Event Type</h1>
        <p className="text-muted-foreground mt-1">
          Update your booking link settings
        </p>
      </div>
      <EventTypeForm initialData={eventType} />
    </div>
  );
}

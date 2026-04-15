"use client";

import { EventTypeForm } from "@/components/admin/event-type-form";

export default function NewEventTypePage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Event Type</h1>
        <p className="text-muted-foreground mt-1">
          Set up a new booking link for invitees
        </p>
      </div>
      <EventTypeForm />
    </div>
  );
}

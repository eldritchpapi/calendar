"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EventTypeData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  duration: number;
  location: string;
  locationType: string;
  color: string;
  availabilityScheduleId: string;
  bufferBefore: number;
  bufferAfter: number;
  maxPerDay: number | null;
  minNotice: number;
  maxFutureDays: number;
  customFields: string;
}

interface Schedule {
  id: string;
  name: string;
}

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

const defaultData: EventTypeData = {
  name: "",
  slug: "",
  description: "",
  duration: 30,
  location: "",
  locationType: "google_meet",
  color: "#3B82F6",
  availabilityScheduleId: "",
  bufferBefore: 0,
  bufferAfter: 0,
  maxPerDay: null,
  minNotice: 60,
  maxFutureDays: 60,
  customFields: "[]",
};

export function EventTypeForm({
  initialData,
}: {
  initialData?: EventTypeData;
}) {
  const router = useRouter();
  const isEditing = !!initialData?.id;
  const [data, setData] = useState<EventTypeData>(initialData ?? defaultData);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((s: Schedule[]) => {
        setSchedules(s);
        if (!data.availabilityScheduleId && s.length > 0) {
          setData((d) => ({ ...d, availabilityScheduleId: s[0].id }));
        }
      });
  }, []);

  const updateSlug = (name: string) => {
    if (!isEditing) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      setData((d) => ({ ...d, name, slug }));
    } else {
      setData((d) => ({ ...d, name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const url = isEditing
      ? `/api/event-types/${initialData!.id}`
      : "/api/event-types";
    const method = isEditing ? "PATCH" : "POST";

    const payload = {
      ...data,
      maxPerDay: data.maxPerDay || null,
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/event-types");
      router.refresh();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to save");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => updateSlug(e.target.value)}
              placeholder="30 Minute Meeting"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/book/</span>
              <Input
                id="slug"
                value={data.slug}
                onChange={(e) =>
                  setData((d) => ({ ...d, slug: e.target.value }))
                }
                placeholder="30-minute-meeting"
                required
                pattern="^[a-z0-9-]+$"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={data.description}
              onChange={(e) =>
                setData((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="A quick chat about your project"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={480}
                value={data.duration}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    duration: parseInt(e.target.value) || 30,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      data.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setData((d) => ({ ...d, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={data.locationType}
              onValueChange={(v) =>
                setData((d) => ({ ...d, locationType: v ?? "google_meet" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_meet">Google Meet</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="in_person">In Person</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">
              {data.locationType === "in_person"
                ? "Address"
                : data.locationType === "custom"
                ? "Meeting URL"
                : "Details (optional)"}
            </Label>
            <Input
              id="location"
              value={data.location}
              onChange={(e) =>
                setData((d) => ({ ...d, location: e.target.value }))
              }
              placeholder={
                data.locationType === "in_person"
                  ? "123 Main St, City"
                  : data.locationType === "phone"
                  ? "+1 555-0123"
                  : "https://..."
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Availability Schedule</Label>
            <Select
              value={data.availabilityScheduleId}
              onValueChange={(v) =>
                setData((d) => ({ ...d, availabilityScheduleId: v ?? "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a schedule" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No schedules yet.{" "}
                <a
                  href="/availability"
                  className="text-primary hover:underline"
                >
                  Create one first.
                </a>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Buffer before (min)</Label>
              <Input
                type="number"
                min={0}
                value={data.bufferBefore}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    bufferBefore: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Buffer after (min)</Label>
              <Input
                type="number"
                min={0}
                value={data.bufferAfter}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    bufferAfter: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Min notice (min)</Label>
              <Input
                type="number"
                min={0}
                value={data.minNotice}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    minNotice: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max future (days)</Label>
              <Input
                type="number"
                min={1}
                value={data.maxFutureDays}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    maxFutureDays: parseInt(e.target.value) || 60,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max per day</Label>
              <Input
                type="number"
                min={0}
                value={data.maxPerDay ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    maxPerDay: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  }))
                }
                placeholder="Unlimited"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Event Type"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/event-types")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

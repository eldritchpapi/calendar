"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Settings {
  host_name: string;
  host_email: string;
  app_url: string;
  google_sync_calendars: string; // JSON array of Google calendar IDs
  google_primary_calendar: string; // Google calendar ID for writes
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  resend_api_key: string;
  resend_from: string;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

const defaults: Settings = {
  host_name: "",
  host_email: "",
  app_url: "",
  google_sync_calendars: "",
  google_primary_calendar: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  resend_api_key: "",
  resend_from: "",
};

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const selectedIds: string[] = (() => {
    try {
      const parsed = JSON.parse(settings.google_sync_calendars || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  useEffect(() => {
    // Handle OAuth callback feedback
    if (searchParams.get("google") === "connected") {
      setNotice({ type: "success", msg: "Google Calendar connected!" });
    } else if (searchParams.get("google_error")) {
      setNotice({
        type: "error",
        msg: `Google connection failed: ${searchParams.get("google_error")}`,
      });
    }

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setSettings((s) => ({ ...s, ...data }));
      });

    fetch("/api/ical-sync/calendars")
      .then((r) => r.json())
      .then((data: { connected: boolean; calendars: GoogleCalendar[] }) => {
        setGoogleConnected(data.connected);
        setCalendars(data.calendars || []);
      })
      .catch(() => {});
  }, [searchParams]);

  const toggleCalendar = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((c) => c !== id)
      : [...selectedIds, id];
    setSettings({ ...settings, google_sync_calendars: JSON.stringify(next) });
  };

  const selectAll = () => {
    const allIds = calendars.map((c) => c.id);
    const primaryId = calendars.find((c) => c.primary)?.id || allIds[0] || "";
    setSettings({
      ...settings,
      google_sync_calendars: JSON.stringify(allIds),
      google_primary_calendar: settings.google_primary_calendar || primaryId,
    });
  };

  const selectNone = () => {
    setSettings({ ...settings, google_sync_calendars: JSON.stringify([]) });
  };

  const disconnectGoogle = async () => {
    if (!confirm("Disconnect Google Calendar? Availability checks and calendar writes will stop.")) return;
    await fetch("/api/google/disconnect", { method: "POST" });
    setGoogleConnected(false);
    setCalendars([]);
    setSettings((s) => ({
      ...s,
      google_sync_calendars: "",
      google_primary_calendar: "",
    }));
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your Calendar.io instance
        </p>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-md text-sm ${
            notice.type === "success"
              ? "bg-green-50 text-green-900 border border-green-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {notice.msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Name</Label>
            <Input
              value={settings.host_name}
              onChange={(e) =>
                setSettings({ ...settings, host_name: e.target.value })
              }
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-2">
            <Label>Your Email</Label>
            <Input
              type="email"
              value={settings.host_email}
              onChange={(e) =>
                setSettings({ ...settings, host_email: e.target.value })
              }
              placeholder="jane@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>App URL</Label>
            <Input
              value={settings.app_url}
              onChange={(e) =>
                setSettings({ ...settings, app_url: e.target.value })
              }
              placeholder="https://book.yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              The public URL where your booking pages live. Used for cancellation links.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!googleConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Google account to sync bookings with your calendar and
                check for conflicts.
              </p>
              <a
                href="/api/google/connect"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                </svg>
                Connect Google Calendar
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm font-medium">Connected</p>
                </div>
                <Button variant="outline" size="sm" onClick={disconnectGoogle}>
                  Disconnect
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Calendars to check for conflicts</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Events in any of these calendars will block availability.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                      disabled={calendars.length === 0}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectNone}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {calendars.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No calendars found.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                    {calendars.map((c) => {
                      const checked = selectedIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                            checked ? "bg-primary/10 text-foreground" : "hover:bg-accent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCalendar(c.id)}
                            className="w-4 h-4 accent-primary shrink-0"
                          />
                          <span className="text-sm truncate">
                            {c.summary}
                            {c.primary && (
                              <span className="ml-1 text-xs text-muted-foreground">(primary)</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedIds.length === 0
                    ? "No calendars selected — only the primary calendar will be checked."
                    : `${selectedIds.length} calendar${selectedIds.length === 1 ? "" : "s"} selected.`}
                </p>
              </div>

              <div className="pt-4 border-t space-y-2">
                <Label>Primary calendar (for new bookings)</Label>
                <p className="text-xs text-muted-foreground">
                  Bookings will be created on this calendar.
                </p>
                <select
                  value={settings.google_primary_calendar}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      google_primary_calendar: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a calendar...</option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary} {c.primary ? "(primary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Resend API Key (recommended)</Label>
            <Input
              type="password"
              value={settings.resend_api_key}
              onChange={(e) =>
                setSettings({ ...settings, resend_api_key: e.target.value })
              }
              placeholder="re_..."
            />
            <p className="text-xs text-muted-foreground">
              Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">resend.com</a> — 3,000 emails/mo free.
            </p>
          </div>
          <div className="space-y-2">
            <Label>From address</Label>
            <Input
              value={settings.resend_from}
              onChange={(e) =>
                setSettings({ ...settings, resend_from: e.target.value })
              }
              placeholder="you@yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              Must be on a domain verified in your Resend account.
            </p>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Prefer SMTP instead?
            </summary>
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={settings.smtp_host}
                    onChange={(e) =>
                      setSettings({ ...settings, smtp_host: e.target.value })
                    }
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    value={settings.smtp_port}
                    onChange={(e) =>
                      setSettings({ ...settings, smtp_port: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={settings.smtp_user}
                  onChange={(e) =>
                    setSettings({ ...settings, smtp_user: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Password / App Password</Label>
                <Input
                  type="password"
                  value={settings.smtp_pass}
                  onChange={(e) =>
                    setSettings({ ...settings, smtp_pass: e.target.value })
                  }
                  placeholder={settings.smtp_pass ? "••••••••" : ""}
                />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600">Settings saved!</span>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}

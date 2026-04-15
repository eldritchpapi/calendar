"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Rule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Schedule {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  rules?: Rule[];
}

const DEFAULT_RULES: Rule[] = [1, 2, 3, 4, 5].map((d) => ({
  dayOfWeek: d,
  startTime: "09:00",
  endTime: "17:00",
}));

export default function AvailabilityPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("Business Hours");
  const [newTz, setNewTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const load = () => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data: Schedule[]) => {
        setSchedules(data);
        if (data.length > 0 && !selected) {
          selectSchedule(data[0].id);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectSchedule = (id: string) => {
    fetch(`/api/availability/${id}`)
      .then((r) => r.json())
      .then((data: Schedule & { rules: Rule[] }) => {
        setSelected(data);
        setRules(data.rules || []);
      });
  };

  const createSchedule = async () => {
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        timezone: newTz,
        isDefault: schedules.length === 0,
        rules: DEFAULT_RULES,
      }),
    });
    if (res.ok) {
      setShowNew(false);
      setNewName("Business Hours");
      load();
      const created = await res.json();
      selectSchedule(created.id);
    }
  };

  const toggleDay = (day: number) => {
    const existing = rules.find((r) => r.dayOfWeek === day);
    if (existing) {
      setRules(rules.filter((r) => r.dayOfWeek !== day));
    } else {
      setRules([...rules, { dayOfWeek: day, startTime: "09:00", endTime: "17:00" }]);
    }
  };

  const updateRule = (day: number, field: "startTime" | "endTime", value: string) => {
    setRules(
      rules.map((r) =>
        r.dayOfWeek === day ? { ...r, [field]: value } : r
      )
    );
  };

  const saveSchedule = async () => {
    if (!selected) return;
    await fetch(`/api/availability/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selected.name,
        timezone: selected.timezone,
        isDefault: selected.isDefault,
        rules,
      }),
    });
    load();
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    await fetch(`/api/availability/${id}`, { method: "DELETE" });
    setSelected(null);
    load();
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Availability</h1>
          <p className="text-muted-foreground mt-1">
            Set your weekly schedules for bookings
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ New Schedule</Button>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Availability Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={newTz}
                  onChange={(e) => setNewTz(e.target.value)}
                />
              </div>
              <Button onClick={createSchedule} className="w-full">
                Create Schedule
              </Button>
            </div>
          </DialogContent>
      </Dialog>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-lg text-muted-foreground">No availability schedules</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a schedule to define when you're available for bookings.
            </p>
            <Button className="mt-4" onClick={() => setShowNew(true)}>
              Create schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Schedule list */}
          <div className="col-span-4 space-y-2">
            {schedules.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSchedule(s.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selected?.id === s.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {s.isDefault && <Badge variant="secondary">Default</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {s.timezone}
                </p>
              </button>
            ))}
          </div>

          {/* Schedule editor */}
          {selected && (
            <div className="col-span-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    <Input
                      value={selected.name}
                      onChange={(e) =>
                        setSelected({ ...selected, name: e.target.value })
                      }
                      className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                    />
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteSchedule(selected.id)}
                  >
                    Delete
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {DAYS.map((day, idx) => {
                      const rule = rules.find((r) => r.dayOfWeek === idx);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-4 py-2"
                        >
                          <Switch
                            checked={!!rule}
                            onCheckedChange={() => toggleDay(idx)}
                          />
                          <span className="w-24 text-sm font-medium">
                            {day}
                          </span>
                          {rule ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={rule.startTime}
                                onChange={(e) =>
                                  updateRule(idx, "startTime", e.target.value)
                                }
                                className="w-32"
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                type="time"
                                value={rule.endTime}
                                onChange={(e) =>
                                  updateRule(idx, "endTime", e.target.value)
                                }
                                className="w-32"
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Unavailable
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t">
                    <Label>Timezone</Label>
                    <Input
                      value={selected.timezone}
                      onChange={(e) =>
                        setSelected({ ...selected, timezone: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>

                  <Button onClick={saveSchedule} className="w-full">
                    Save Schedule
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

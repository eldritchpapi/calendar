"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WorkflowStep {
  id?: string;
  stepOrder: number;
  action: string;
  delayMinutes: number;
  emailSubject: string;
  emailBody: string;
  recipientType: string;
}

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  steps?: WorkflowStep[];
}

const TRIGGER_LABELS: Record<string, string> = {
  booking_created: "When a booking is created",
  booking_cancelled: "When a booking is cancelled",
  before_meeting: "Before a meeting",
  after_meeting: "After a meeting",
};

const TEMPLATES = [
  {
    name: "Booking Confirmation",
    trigger: "booking_created",
    steps: [
      {
        stepOrder: 0,
        action: "send_email",
        delayMinutes: 0,
        emailSubject: "Booking Confirmed: {{event_name}}",
        emailBody: `<h2>Your meeting is confirmed!</h2>
<p>Hi {{name}},</p>
<p>Your <strong>{{event_name}}</strong> has been scheduled for:</p>
<p><strong>{{date}} at {{time}}</strong></p>
<p>Location: {{location}}</p>
<p>Need to cancel? <a href="{{cancel_link}}">Click here</a></p>`,
        recipientType: "invitee",
      },
    ],
  },
  {
    name: "24h Reminder",
    trigger: "before_meeting",
    steps: [
      {
        stepOrder: 0,
        action: "send_email",
        delayMinutes: -1440,
        emailSubject: "Reminder: {{event_name}} tomorrow",
        emailBody: `<p>Hi {{name}},</p>
<p>Just a reminder that your <strong>{{event_name}}</strong> is tomorrow at <strong>{{time}}</strong>.</p>
<p>Location: {{location}}</p>
<p>See you there!</p>`,
        recipientType: "invitee",
      },
    ],
  },
  {
    name: "Thank You Follow-up",
    trigger: "after_meeting",
    steps: [
      {
        stepOrder: 0,
        action: "send_email",
        delayMinutes: 60,
        emailSubject: "Thanks for meeting!",
        emailBody: `<p>Hi {{name}},</p>
<p>Thanks for taking the time to meet today. I hope it was valuable!</p>
<p>If you'd like to schedule another meeting, you can book here: {{booking_link}}</p>`,
        recipientType: "invitee",
      },
    ],
  },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    trigger: "booking_created",
    steps: [
      {
        stepOrder: 0,
        action: "send_email",
        delayMinutes: 0,
        emailSubject: "",
        emailBody: "",
        recipientType: "invitee",
      },
    ] as WorkflowStep[],
  });

  const load = () => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then(setWorkflows)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createFromTemplate = async (template: (typeof TEMPLATES)[0]) => {
    await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
    load();
  };

  const saveWorkflow = async () => {
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/workflows/${editingId}` : "/api/workflows";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setShowNew(false);
    setEditingId(null);
    load();
  };

  const toggleWorkflow = async (id: string, isActive: boolean) => {
    await fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isActive } : w))
    );
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    load();
  };

  const editWorkflow = async (id: string) => {
    const res = await fetch(`/api/workflows/${id}`);
    const data = await res.json();
    setFormData({
      name: data.name,
      trigger: data.trigger,
      steps: data.steps || [],
    });
    setEditingId(id);
    setShowNew(true);
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Automated emails triggered by booking events
          </p>
        </div>
        <Button onClick={() => {
          setFormData({
            name: "",
            trigger: "booking_created",
            steps: [{
              stepOrder: 0, action: "send_email", delayMinutes: 0,
              emailSubject: "", emailBody: "", recipientType: "invitee",
            }],
          });
          setEditingId(null);
          setShowNew(true);
        }}>
          + Create Workflow
        </Button>
      </div>
      <Dialog open={showNew} onOpenChange={(open) => { setShowNew(open); if (!open) setEditingId(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Create"} Workflow</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Booking Confirmation"
                />
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(v) => setFormData({ ...formData, trigger: v ?? "booking_created" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.steps.map((step, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Step {idx + 1}: Send Email</h4>
                      <Select
                        value={step.recipientType}
                        onValueChange={(v) => {
                          const steps = [...formData.steps];
                          steps[idx] = { ...steps[idx], recipientType: v ?? "invitee" };
                          setFormData({ ...formData, steps });
                        }}
                      >
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invitee">Invitee</SelectItem>
                          <SelectItem value="host">Host</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Delay (minutes, negative = before)</Label>
                      <Input
                        type="number"
                        value={step.delayMinutes}
                        onChange={(e) => {
                          const steps = [...formData.steps];
                          steps[idx] = { ...steps[idx], delayMinutes: parseInt(e.target.value) || 0 };
                          setFormData({ ...formData, steps });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input
                        value={step.emailSubject}
                        onChange={(e) => {
                          const steps = [...formData.steps];
                          steps[idx] = { ...steps[idx], emailSubject: e.target.value };
                          setFormData({ ...formData, steps });
                        }}
                        placeholder="Meeting Confirmed: {{event_name}}"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Body (HTML)</Label>
                      <Textarea
                        value={step.emailBody}
                        onChange={(e) => {
                          const steps = [...formData.steps];
                          steps[idx] = { ...steps[idx], emailBody: e.target.value };
                          setFormData({ ...formData, steps });
                        }}
                        rows={6}
                        placeholder="<p>Hi {{name}},</p>"
                      />
                      <p className="text-xs text-muted-foreground">
                        Variables: {"{{name}}"} {"{{email}}"} {"{{event_name}}"} {"{{date}}"} {"{{time}}"} {"{{location}}"} {"{{cancel_link}}"} {"{{booking_link}}"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button onClick={saveWorkflow} className="w-full">
                {editingId ? "Save Changes" : "Create Workflow"}
              </Button>
            </div>
          </DialogContent>
      </Dialog>

      {/* Templates */}
      {workflows.length === 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <Card key={t.name} className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => createFromTemplate(t)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_LABELS[t.trigger]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Workflow list */}
      {workflows.length > 0 && (
        <div className="space-y-3">
          {workflows.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Switch
                  checked={w.isActive}
                  onCheckedChange={(v) => toggleWorkflow(w.id, v)}
                />
                <div className="flex-1">
                  <h3 className="font-medium">{w.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {TRIGGER_LABELS[w.trigger] || w.trigger}
                  </p>
                </div>
                <Badge variant={w.isActive ? "default" : "secondary"}>
                  {w.isActive ? "Active" : "Paused"}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => editWorkflow(w.id)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteWorkflow(w.id)}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

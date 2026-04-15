import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const availabilitySchedules = sqliteTable("availability_schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const availabilityRules = sqliteTable("availability_rules", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id")
    .notNull()
    .references(() => availabilitySchedules.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

export const dateOverrides = sqliteTable("date_overrides", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id")
    .notNull()
    .references(() => availabilitySchedules.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  isBlocked: integer("is_blocked", { mode: "boolean" }).default(false),
  startTime: text("start_time"),
  endTime: text("end_time"),
});

export const eventTypes = sqliteTable("event_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  duration: integer("duration").notNull(),
  location: text("location"),
  locationType: text("location_type"),
  color: text("color").default("#3B82F6"),
  availabilityScheduleId: text("availability_schedule_id").references(
    () => availabilitySchedules.id
  ),
  bufferBefore: integer("buffer_before").default(0),
  bufferAfter: integer("buffer_after").default(0),
  maxPerDay: integer("max_per_day"),
  minNotice: integer("min_notice").default(60),
  maxFutureDays: integer("max_future_days").default(60),
  customFields: text("custom_fields"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  // Payments — price in cents, null = free
  price: integer("price"),
  currency: text("currency").default("usd"),
  priceLabel: text("price_label"), // e.g. "$250 / 5-call package"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  company: text("company"),
  tags: text("tags"),
  customData: text("custom_data"),
  notes: text("notes"),
  totalBookings: integer("total_bookings").default(0),
  lastBookedAt: text("last_booked_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  eventTypeId: text("event_type_id")
    .notNull()
    .references(() => eventTypes.id),
  contactId: text("contact_id").references(() => contacts.id),
  title: text("title").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  timezone: text("timezone").notNull(),
  status: text("status").notNull().default("confirmed"),
  location: text("location"),
  notes: text("notes"),
  customFieldData: text("custom_field_data"),
  cancellationToken: text("cancellation_token"),
  icalEventId: text("ical_event_id"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amountPaid: integer("amount_paid"), // cents
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  cancelledAt: text("cancelled_at"),
});

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  eventTypeId: text("event_type_id").references(() => eventTypes.id),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const workflowSteps = sqliteTable("workflow_steps", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  action: text("action").notNull(),
  delayMinutes: integer("delay_minutes").default(0),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  recipientType: text("recipient_type").default("invitee"),
});

export const workflowExecutions = sqliteTable("workflow_executions", {
  id: text("id").primaryKey(),
  workflowStepId: text("workflow_step_id")
    .notNull()
    .references(() => workflowSteps.id),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookings.id),
  scheduledFor: text("scheduled_for").notNull(),
  executedAt: text("executed_at"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

import nodemailer from "nodemailer";
import { Resend } from "resend";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  icalAttachment?: { content: string; filename: string };
}

/**
 * Send an email using Resend (preferred) or SMTP (fallback).
 *
 * Credentials precedence:
 *   1. RESEND_API_KEY env var → Resend
 *   2. resend_api_key setting → Resend
 *   3. smtp_* settings → nodemailer
 *   4. None → log to console
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const envResendKey = process.env.RESEND_API_KEY;
  const dbResendKey = await getSetting("resend_api_key");
  const resendKey = envResendKey || dbResendKey;

  const hostName = (await getSetting("host_name")) || "Calendar.io";

  // ------- Resend path -------
  if (resendKey) {
    const fromAddr =
      (await getSetting("resend_from")) ||
      process.env.RESEND_FROM ||
      "";
    if (!fromAddr) {
      console.error("[Email] Resend key set but no 'from' address configured");
      return false;
    }

    const resend = new Resend(resendKey);
    try {
      const attachments = options.icalAttachment
        ? [
            {
              filename: options.icalAttachment.filename,
              content: options.icalAttachment.content,
              contentType: "text/calendar",
            },
          ]
        : undefined;

      const result = await resend.emails.send({
        from: `${hostName} <${fromAddr}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments,
      });

      if (result.error) {
        console.error("[Email/Resend] Failed:", result.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("[Email/Resend] Exception:", error);
      return false;
    }
  }

  // ------- SMTP path -------
  const host = await getSetting("smtp_host");
  const port = await getSetting("smtp_port");
  const user = await getSetting("smtp_user");
  const pass = await getSetting("smtp_pass");

  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port || "587"),
      secure: parseInt(port || "587") === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: `"${hostName}" <${user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.icalAttachment
          ? [
              {
                filename: options.icalAttachment.filename,
                content: options.icalAttachment.content,
                contentType: "text/calendar",
              },
            ]
          : undefined,
      });
      return true;
    } catch (error) {
      console.error("[Email/SMTP] Failed:", error);
      return false;
    }
  }

  // ------- Dev fallback -------
  console.log(
    "[Email] No provider configured. Would send:",
    options.subject,
    "to",
    options.to
  );
  return false;
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

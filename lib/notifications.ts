import nodemailer from "nodemailer";
import prisma from "@/lib/db";

export type NotificationChannel = "email" | "sms" | "push";
export type NotificationTemplate =
  | "welcome"
  | "payment_receipt"
  | "result"
  | "certificate"
  | "quiz_reminder"
  | "winner"
  | "otp"
  | "prize";

interface SendInput {
  channel: NotificationChannel;
  template: NotificationTemplate;
  recipient: string;
  subject?: string;
  body: string;
  userId?: string | null;
}

let cachedTransport: nodemailer.Transporter | null = null;
const transport = (): nodemailer.Transporter | null => {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransport;
};

const sendEmail = async (to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> => {
  const t = transport();
  if (!t) {
    console.log(`[notify] (email stub) -> ${to} | ${subject}`);
    return { ok: true };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? "QuizMasters India <no-reply@quizmasters.local>",
      to,
      subject,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;background:#0B0D19;color:#fff;padding:24px;border-radius:12px;"><h2 style="margin:0 0 12px;background:linear-gradient(135deg,#2563EB,#F59E0B,#10B981);-webkit-background-clip:text;color:transparent;">QuizMasters India</h2><pre style="white-space:pre-wrap;font-family:inherit;color:#e5e7eb;">${body.replace(/</g, "&lt;")}</pre></div>`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
};

const sendSms = async (to: string, body: string): Promise<{ ok: boolean; error?: string }> => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log(`[notify] (sms stub) -> ${to}: ${body.slice(0, 60)}`);
    return { ok: true };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    if (!res.ok) return { ok: false, error: `Twilio HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "sms failed" };
  }
};

const sendPush = async (to: string, body: string): Promise<{ ok: boolean; error?: string }> => {
  // Web Push requires per-user subscription endpoints + VAPID keys; we log to NotificationLog
  // so admins can see queued pushes until subscription storage is wired client-side.
  console.log(`[notify] (push queued) -> ${to}: ${body.slice(0, 60)}`);
  return { ok: true };
};

export const sendNotification = async (input: SendInput): Promise<void> => {
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;

  try {
    let result: { ok: boolean; error?: string };
    if (input.channel === "email") {
      result = await sendEmail(input.recipient, input.subject ?? "QuizMasters India", input.body);
    } else if (input.channel === "sms") {
      result = await sendSms(input.recipient, input.body);
    } else {
      result = await sendPush(input.recipient, input.body);
    }
    if (!result.ok) {
      status = "failed";
      error = result.error ?? "unknown";
    }
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : "unknown";
  }

  try {
    await prisma.notificationLog.create({
      data: {
        userId: input.userId ?? null,
        channel: input.channel,
        template: input.template,
        recipient: input.recipient,
        subject: input.subject ?? null,
        body: input.body,
        status,
        error,
      },
    });
  } catch (err) {
    console.error("[notify] log persist failed:", err);
  }
};

export const notifyByEmail = (
  userId: string | null,
  recipient: string,
  template: NotificationTemplate,
  subject: string,
  body: string
) => sendNotification({ channel: "email", template, recipient, subject, body, userId });

import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

let transporter: Transporter | null = null;

/** Lazily build the SMTP transporter from env config. */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  if (transporter) return transporter;
  const config: SMTPTransport.Options = {
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  };
  transporter = nodemailer.createTransport(config);
  return transporter;
}

export interface MailInput {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export function mailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

/**
 * Single send entry point. Emails are strictly best-effort: any failure is
 * logged and swallowed so mail can never break the primary issue flow.
 */
export async function sendMail(input: MailInput): Promise<void> {
  if (!mailEnabled()) return;
  const smtp = getTransporter();
  const from = process.env.EMAIL_FROM;
  if (!smtp || !from) return;

  const to = [...new Set(input.to.map((e) => e.trim().toLowerCase()))].filter(Boolean);
  if (to.length === 0) return;

  try {
    await smtp.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "servox-phi"}" <${from}>`,
      to: to.join(", "),
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (e) {
    console.error("sendMail failed:", e);
  }
}

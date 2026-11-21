import nodemailer from "nodemailer";
import { siteConfig } from "./config.ts";

/**
 * メール送信。SMTP_HOST が設定されていれば SMTP で送信し、
 * 未設定なら開発用にサーバーログへ出力する。
 */
export type MailResult = { delivered: boolean; provider: "smtp" | "console" };

export function mailProvider(): "smtp" | "console" {
  return process.env.SMTP_HOST ? "smtp" : "console";
}

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  if (mailProvider() === "console") {
    console.log(`\n===== [MAIL to ${to}] ${subject} =====\n${text}\n====================\n`);
    return { delivered: false, provider: "console" };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? `${siteConfig.auctionName} <no-reply@localhost>`,
    to,
    subject,
    text,
  });
  return { delivered: true, provider: "smtp" };
}

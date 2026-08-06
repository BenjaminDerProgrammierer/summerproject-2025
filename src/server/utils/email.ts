import nodemailer from 'nodemailer';
import type { SendMailOptions, SentMessageInfo, Transporter } from 'nodemailer';

export interface EmailOptions extends Omit<SendMailOptions, 'from' | 'subject' | 'to'> {
  from?: SendMailOptions['from'];
  subject: string;
  to: SendMailOptions['to'];
}

let transporter: Transporter<SentMessageInfo> | undefined;

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be provided to send email`);
  return value;
}

function getTransporter(): Transporter<SentMessageInfo> {
  if (transporter) return transporter;

  const host = requiredEnvironmentVariable('SMTP_HOST');
  const portValue = process.env.SMTP_PORT?.trim() || '587';
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if ((user && !pass) || (!user && pass)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be provided together');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || (process.env.SMTP_SECURE === undefined && port === 465),
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
  return transporter;
}

/** Send an email through the configured SMTP server. */
export async function sendEmail(options: EmailOptions): Promise<SentMessageInfo> {
  if (!options.text && !options.html) {
    throw new Error('An email must include text or HTML content');
  }

  return getTransporter().sendMail({
    ...options,
    from: options.from ?? requiredEnvironmentVariable('SMTP_FROM'),
  });
}

/** Check that the configured SMTP server is reachable and accepts authentication. */
export async function verifyEmailTransport(): Promise<boolean> {
  return getTransporter().verify();
}

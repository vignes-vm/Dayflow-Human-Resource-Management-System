import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/logger.js";

/**
 * Nodemailer wrapper — real SMTP when SMTP_HOST is set, an Ethereal test
 * account otherwise (dev/CI). Never let a mail failure block a request: every
 * exported send* function resolves even if delivery fails, and the caller is
 * expected to also return the raw URL/token in the response body in
 * non-production environments so the demo never depends on an inbox.
 */

let transporterPromise: Promise<Transporter> | null = null;

function getTransporter(): Promise<Transporter> {
  transporterPromise ??= (async () => {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  })();
  return transporterPromise;
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F8FB;font-family:Arial,Helvetica,sans-serif;color:#0E1116;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0"
            style="background:#FFFFFF;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background:#4C46E5;padding:20px 32px;">
                <span style="color:#FFFFFF;font-size:20px;font-weight:600;">Dayflow</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;color:#8C93A1;font-size:12px;">
                Every workday, perfectly aligned.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#4C46E5;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:600;">${label}</a>`;
}

export interface SendResult {
  previewUrl?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM ?? "Dayflow <no-reply@dayflow.app>",
      to,
      subject,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) logger.info("email preview", { to, subject, previewUrl });
    return { previewUrl: previewUrl || undefined };
  } catch (err) {
    logger.error("email send failed", { to, subject, error: String(err) });
    return {};
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<SendResult> {
  const html = layout(
    "Verify your email",
    `<p>Welcome to Dayflow. Confirm your email address to activate your company account.</p>${button(
      verifyUrl,
      "Verify email",
    )}<p style="margin-top:16px;font-size:12px;color:#8C93A1;">This link expires in 24 hours.</p>`,
  );
  return send(to, "Verify your Dayflow account", html);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendResult> {
  const html = layout(
    "Reset your password",
    `<p>We received a request to reset your Dayflow password. If this wasn't you, ignore this email.</p>${button(
      resetUrl,
      "Reset password",
    )}<p style="margin-top:16px;font-size:12px;color:#8C93A1;">This link expires in 1 hour.</p>`,
  );
  return send(to, "Reset your Dayflow password", html);
}

export async function sendCredentialsEmail(
  to: string,
  params: { name: string; loginId: string; password: string; appUrl: string },
): Promise<SendResult> {
  const html = layout(
    "Your Dayflow account is ready",
    `<p>Hi ${params.name}, an account has been created for you on Dayflow.</p>
     <p><strong>Login ID:</strong> ${params.loginId}<br/><strong>Password:</strong> ${params.password}</p>
     <p>You'll be asked to choose a new password the first time you sign in.</p>
     ${button(params.appUrl, "Sign in")}`,
  );
  return send(to, "Your Dayflow account is ready", html);
}

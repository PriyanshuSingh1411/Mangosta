import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error("SMTP is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
  });
}

export async function sendEmailOtp(
  email: string,
  otp: string,
  purpose: "signup" | "signin"
) {
  const user = process.env.SMTP_USER;
  const transporter = getTransporter();
  const isSignup = purpose === "signup";

  await transporter.sendMail({
    from: `MANGOSTA <${user}>`,
    to: email,
    subject: isSignup
      ? "Your MANGOSTA verification code"
      : "Your MANGOSTA sign in code",
    text: `Your MANGOSTA verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;font-family:Arial,sans-serif;color:#f2efe7;">
        <div style="max-width:520px;margin:0 auto;border:1px solid #2a2926;padding:32px;background:#141311;">
          <p style="font-size:11px;letter-spacing:3px;color:#9d998f;margin:0 0 18px;">MANGOSTA / AUTHENTICATION</p>
          <h1 style="font-size:28px;line-height:1;margin:0 0 14px;">${isSignup ? "VERIFY YOUR EMAIL" : "SIGN IN TO MANGOSTA"}</h1>
          <p style="font-size:14px;line-height:1.7;color:#bdb8ad;margin:0 0 24px;">Use the verification code below to ${isSignup ? "finish creating your account" : "continue signing in"}.</p>
          <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#0a0a0a;border:1px solid #393631;padding:22px;text-align:center;color:#f2efe7;">${otp}</div>
          <p style="font-size:12px;line-height:1.6;color:#7c776e;margin:18px 0 0;">This code expires in 10 minutes and can only be used once.</p>
          <p style="font-size:12px;color:#7c776e;margin:24px 0 0;">MANGOSTA — WEAR YOUR ATTITUDE.</p>
        </div>
      </div>
    `,
  });
}

// ============================================================
// STORE EMAILS (back in stock, bag reminders, returns)
// ============================================================

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
  );
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The MANGOSTA email frame used by all store emails. Every text value is
 * escaped here; `contentHtml` must already be safe HTML.
 */
export function storeEmailLayout({
  eyebrow,
  heading,
  intro,
  contentHtml = "",
  buttonText,
  buttonUrl,
}: {
  eyebrow: string;
  heading: string;
  intro: string;
  contentHtml?: string;
  buttonText?: string;
  buttonUrl?: string;
}): string {
  const button =
    buttonText && buttonUrl
      ? `<a href="${escapeHtml(buttonUrl)}" style="display:inline-block;margin-top:26px;background:#f5f2ec;color:#0a0a0a;text-decoration:none;font-size:12px;letter-spacing:2px;font-weight:700;padding:15px 26px;">${escapeHtml(buttonText)}</a>`
      : "";

  return `
    <div style="background:#0a0a0a;padding:40px 20px;font-family:Arial,sans-serif;color:#f2efe7;">
      <div style="max-width:560px;margin:0 auto;border:1px solid #2a2926;padding:32px;background:#141311;">
        <p style="font-size:11px;letter-spacing:3px;color:#9d998f;margin:0 0 18px;">${escapeHtml(eyebrow)}</p>
        <h1 style="font-size:28px;line-height:1.05;margin:0 0 14px;">${escapeHtml(heading)}</h1>
        <p style="font-size:14px;line-height:1.7;color:#bdb8ad;margin:0;white-space:pre-line;">${escapeHtml(intro)}</p>
        ${contentHtml}
        ${button}
        <p style="font-size:12px;color:#7c776e;margin:28px 0 0;">MANGOSTA — WEAR YOUR ATTITUDE.</p>
      </div>
    </div>
  `;
}

/** One product row (image, name, detail line) for store emails. */
export function storeEmailProductRow({
  image,
  name,
  detail,
}: {
  image: string;
  name: string;
  detail: string;
}): string {
  const img = image
    ? `<img src="${escapeHtml(image)}" alt="" width="64" height="80" style="width:64px;height:80px;object-fit:cover;background:#0a0a0a;display:block;" />`
    : `<div style="width:64px;height:80px;background:#0a0a0a;"></div>`;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #2a2926;padding-top:14px;width:100%;">
      <tr>
        <td style="width:76px;vertical-align:top;">${img}</td>
        <td style="vertical-align:top;font-size:13px;line-height:1.6;color:#f2efe7;">
          <strong>${escapeHtml(name)}</strong><br />
          <span style="color:#9d998f;">${escapeHtml(detail)}</span>
        </td>
      </tr>
    </table>
  `;
}

export async function sendStoreEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `MANGOSTA <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

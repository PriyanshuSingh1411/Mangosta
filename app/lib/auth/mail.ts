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

/**
 * The 6-digit code email.
 *   signin  → "Sign in to MANGOSTA"
 *   signup  → "Verify your email" (finish creating the account)
 *   existing-account → someone tried to SIGN UP with an email that already
 *              has an account: the code simply signs them in.
 *   delete-account → confirms deleting the account (Account page).
 */
export async function sendEmailOtp(
  email: string,
  otp: string,
  purpose: "signup" | "signin" | "existing-account" | "delete-account" | "contact-change"
) {
  const user = process.env.SMTP_USER;
  const transporter = getTransporter();
  const isSignup = purpose === "signup";
  const isExisting = purpose === "existing-account";
  const isDelete = purpose === "delete-account";
  const isContactChange = purpose === "contact-change";

  const heading = isSignup || isContactChange
    ? "VERIFY YOUR EMAIL"
    : isDelete
      ? "DELETE YOUR ACCOUNT"
      : "SIGN IN TO MANGOSTA";
  const intro = isSignup
    ? "Use the verification code below to finish creating your account."
    : isExisting
      ? "You already have a MANGOSTA account with this email, so there's no need to sign up again. Use the code below to sign in."
      : isDelete
        ? "You asked to delete your MANGOSTA account. Enter this code on the Account page to confirm. Deleting can't be undone. If you didn't ask for this, ignore this email and your account stays as it is."
        : isContactChange
          ? "Use this code to verify the new email address on your MANGOSTA account. If you did not request this change, ignore this email."
          : "Use the verification code below to continue signing in.";

  await transporter.sendMail({
    from: `MANGOSTA <${user}>`,
    to: email,
    subject: isSignup || isContactChange
      ? "Your MANGOSTA verification code"
      : isDelete
        ? "Your MANGOSTA account deletion code"
        : "Your MANGOSTA sign in code",
    text: isDelete
      ? `Your code to delete your MANGOSTA account is ${otp}. It expires in 10 minutes. Deleting can't be undone. If you didn't ask for this, ignore this email and your account stays as it is.`
      : isContactChange
        ? `Your MANGOSTA email verification code is ${otp}. It expires in 10 minutes. If you did not request this change, you can ignore this email.`
        : `${isExisting ? "You already have a MANGOSTA account with this email. " : ""}Your MANGOSTA verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `
      <div style="background:#0a0a0a;padding:40px 20px;font-family:Arial,sans-serif;color:#f2efe7;">
        <div style="max-width:520px;margin:0 auto;border:1px solid #2a2926;padding:32px;background:#141311;">
          <p style="font-size:11px;letter-spacing:3px;color:#9d998f;margin:0 0 18px;">MANGOSTA / AUTHENTICATION</p>
          <h1 style="font-size:28px;line-height:1;margin:0 0 14px;">${heading}</h1>
          <p style="font-size:14px;line-height:1.7;color:#bdb8ad;margin:0 0 24px;">${intro}</p>
          <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#0a0a0a;border:1px solid #393631;padding:22px;text-align:center;color:#f2efe7;">${otp}</div>
          <p style="font-size:12px;line-height:1.6;color:#7c776e;margin:18px 0 0;">This code expires in 10 minutes and can only be used once.</p>
          <p style="font-size:12px;color:#7c776e;margin:24px 0 0;">MANGOSTA — WEAR YOUR ATTITUDE.</p>
        </div>
      </div>
    `,
  });
}

/**
 * Someone asked to SIGN IN with an email that has no account. The website
 * gives the same answer as for a real account (so it never reveals who has
 * one); the owner of the inbox gets this instead of a code.
 */
export async function sendNoAccountEmail(email: string, siteUrl: string) {
  const user = process.env.SMTP_USER;
  const transporter = getTransporter();
  const signupUrl = `${siteUrl}/?auth=signup`;

  await transporter.sendMail({
    from: `MANGOSTA <${user}>`,
    to: email,
    subject: "Your MANGOSTA sign in request",
    text: `Someone (hopefully you) asked to sign in to MANGOSTA with this email, but there's no account for it yet. Create one here: ${signupUrl}\n\nDidn't ask for this? You can ignore this email.`,
    html: storeEmailLayout({
      eyebrow: "MANGOSTA / AUTHENTICATION",
      heading: "NO ACCOUNT YET",
      intro:
        "Someone (hopefully you) asked to sign in to MANGOSTA with this email, but there's no account for it yet. It takes a minute to create one.\n\nDidn't ask for this? You can ignore this email.",
      buttonText: "CREATE ACCOUNT",
      buttonUrl: signupUrl,
    }),
  });
}

/** Sent after an account has been deleted (to its former email). */
export async function sendAccountDeletedEmail(email: string) {
  const user = process.env.SMTP_USER;
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `MANGOSTA <${user}>`,
    to: email,
    subject: "Your MANGOSTA account has been deleted",
    text: "Your MANGOSTA account has been deleted, together with your saved addresses, bag, wishlist, alerts and newsletter subscription. Records of past orders and returns are kept as the law requires. You're welcome back any time.",
    html: storeEmailLayout({
      eyebrow: "MANGOSTA / ACCOUNT",
      heading: "ACCOUNT DELETED",
      intro:
        "Your MANGOSTA account has been deleted, together with your saved addresses, bag, wishlist, alerts and newsletter subscription.\n\nRecords of past orders and returns are kept as the law requires. You're welcome back any time.",
    }),
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
  footerHtml = "",
}: {
  eyebrow: string;
  heading: string;
  intro: string;
  contentHtml?: string;
  buttonText?: string;
  buttonUrl?: string;
  /** Already-safe HTML under the brand line (e.g. the unsubscribe link). */
  footerHtml?: string;
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
        ${footerHtml}
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
  headers,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe on marketing emails. */
  headers?: Record<string, string>;
}): Promise<void> {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `MANGOSTA <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
    ...(headers ? { headers } : {}),
  });
}

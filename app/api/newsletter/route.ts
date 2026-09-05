import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { getSettings } from "@/app/lib/dataStore";
import { addSubscriber } from "@/app/lib/newsletterStore";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtml(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const text = paragraph
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />");

      return `<p style="margin:0 0 20px;">${text}</p>`;
    })
    .join("");
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error(
      "SMTP configuration is missing."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user,
      pass: password,
    },
  });
}

function getWelcomeEmailHtml(
  email: string,
  settings: Awaited<ReturnType<typeof getSettings>>
) {
  const buttonUrl = settings.newsletterButtonUrl || "/";

  const buttonHref = buttonUrl.startsWith("http")
    ? buttonUrl
    : `${process.env.NEXT_PUBLIC_SITE_URL || ""}${buttonUrl}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>${escapeHtml(settings.newsletterSubject)}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#090909;
    color:#f4f0e8;
    font-family:Arial, Helvetica, sans-serif;
  "
>
  <div
    style="
      width:100%;
      background:#090909;
      padding:40px 20px;
      box-sizing:border-box;
    "
  >
    <div
      style="
        max-width:640px;
        margin:0 auto;
        background:#111111;
        border:1px solid #292929;
      "
    >

      <!-- HEADER -->

      <div
        style="
          padding:32px;
          border-bottom:1px solid #292929;
        "
      >
        <div
          style="
            font-size:28px;
            font-weight:800;
            letter-spacing:0.18em;
            color:#ffffff;
          "
        >
          MANGOSTA
        </div>
      </div>

      <!-- CONTENT -->

      <div style="padding:40px 32px;">

        <div
          style="
            font-size:11px;
            letter-spacing:0.18em;
            color:#999999;
            margin-bottom:20px;
          "
        >
          WELCOME
        </div>

        <h1
          style="
            margin:0 0 24px;
            font-size:34px;
            line-height:1.05;
            font-weight:800;
            letter-spacing:-0.02em;
            color:#ffffff;
          "
        >
          ${escapeHtml(settings.newsletterHeading)}
        </h1>

        <div
          style="
            font-size:15px;
            line-height:1.7;
            color:#c8c4bc;
          "
        >
          ${textToHtml(settings.newsletterBody)}
        </div>

        ${
          settings.newsletterButtonText
            ? `
              <div style="margin-top:32px;">
                <a
                  href="${escapeHtml(buttonHref)}"
                  style="
                    display:inline-block;
                    padding:15px 24px;
                    background:#f4f0e8;
                    color:#090909;
                    text-decoration:none;
                    font-size:11px;
                    font-weight:700;
                    letter-spacing:0.16em;
                  "
                >
                  ${escapeHtml(settings.newsletterButtonText)}
                </a>
              </div>
            `
            : ""
        }

      </div>

      <!-- FOOTER -->

      <div
        style="
          padding:24px 32px;
          border-top:1px solid #292929;
        "
      >
        <div
          style="
            font-size:11px;
            line-height:1.6;
            color:#777777;
          "
        >
          ${escapeHtml(settings.newsletterFooterText)}
        </div>

        <div
          style="
            margin-top:12px;
            font-size:10px;
            color:#555555;
          "
        >
          Sent to ${escapeHtml(email)}
        </div>
      </div>

    </div>
  </div>
</body>
</html>
`;
}

function getNotificationEmailHtml(email: string) {
  return `
<!DOCTYPE html>
<html>
<body
  style="
    margin:0;
    padding:40px;
    background:#090909;
    color:#f4f0e8;
    font-family:Arial, Helvetica, sans-serif;
  "
>
  <div
    style="
      max-width:600px;
      margin:0 auto;
      padding:32px;
      background:#111111;
      border:1px solid #292929;
    "
  >
    <div
      style="
        font-size:26px;
        font-weight:800;
        letter-spacing:0.15em;
        margin-bottom:30px;
      "
    >
      MANGOSTA
    </div>

    <div
      style="
        font-size:11px;
        letter-spacing:0.16em;
        color:#999999;
        margin-bottom:12px;
      "
    >
      NEW NEWSLETTER SUBSCRIBER
    </div>

    <div
      style="
        font-size:20px;
        color:#ffffff;
      "
    >
      ${escapeHtml(email)}
    </div>

    <div
      style="
        margin-top:24px;
        font-size:12px;
        color:#777777;
      "
    >
      Someone joined the MANGOSTA WORLD newsletter from the website.
    </div>
  </div>
</body>
</html>
`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        {
          error: "Email address is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Basic email validation.
     */

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        {
          error: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    /*
     * Load email settings drafted by admin.
     */

    const settings = await getSettings();

    if (!settings.newsletterEnabled) {
      return NextResponse.json(
        {
          error:
            "Newsletter subscriptions are currently disabled.",
        },
        { status: 403 }
      );
    }

    /*
     * Save subscriber.
     */

    const result = await addSubscriber(email);

    /*
     * Existing subscriber:
     * Do NOT send welcome email again.
     */

    if (!result.isNew) {
      return NextResponse.json({
        success: true,
        alreadySubscribed: true,
        message:
          "You are already subscribed to the MANGOSTA WORLD.",
      });
    }

    /*
     * SMTP transporter.
     */

    const transporter = createTransporter();

    const sender =
      process.env.SMTP_USER || "mangostateam@gmail.com";

    /*
     * Send welcome email to subscriber.
     */

    await transporter.sendMail({
      from: `"MANGOSTA" <${sender}>`,
      to: email,
      subject: settings.newsletterSubject,
      text: [
        settings.newsletterHeading,
        "",
        settings.newsletterBody,
        "",
        settings.newsletterButtonText
          ? `${settings.newsletterButtonText}: ${settings.newsletterButtonUrl}`
          : "",
        "",
        settings.newsletterFooterText,
      ]
        .filter(Boolean)
        .join("\n"),
      html: getWelcomeEmailHtml(
        email,
        settings
      ),
    });

    /*
     * Send notification to admin.
     */

    const notificationEmail =
  settings.newsletterNotificationEmail?.trim();

if (
  settings.newsletterNotificationEnabled &&
  notificationEmail
) {
  await transporter.sendMail({
    from: `"MANGOSTA Website" <${sender}>`,
    to: notificationEmail,
    subject: `New MANGOSTA subscriber: ${email}`,
    text: `New newsletter subscriber: ${email}`,
    html: getNotificationEmailHtml(email),
  });
}
    return NextResponse.json({
      success: true,
      alreadySubscribed: false,
      message:
        "Welcome to the MANGOSTA WORLD.",
    });
  } catch (error) {
    console.error(
      "Newsletter subscription error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to complete your subscription right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
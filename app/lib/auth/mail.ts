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

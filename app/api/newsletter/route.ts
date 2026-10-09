import { NextRequest, NextResponse } from "next/server";

import { getSettings } from "@/app/lib/dataStore";
import { activateSubscriber, requestSubscription } from "@/app/lib/newsletterStore";
import { isValidEmail } from "@/app/lib/auth/otp";
import { getCurrentUser } from "@/app/lib/auth/session";
import { clearMarketingOptOut } from "@/app/lib/emailPreferences";
import {
  sendNewsletterConfirmEmail,
  sendNewsletterSignupAlert,
  sendNewsletterWelcome,
} from "@/app/lib/newsletterEmails";
import {
  consumeRateLimits,
  describeWait,
  getClientIp,
} from "@/app/lib/rateLimit";

const HOUR_MS = 60 * 60 * 1000;

/**
 * POST /api/newsletter { email } — the "Join MANGOSTA WORLD" form.
 *
 * Nobody is subscribed from the form alone (anyone can type any email):
 * a confirm link goes to that inbox first, and the welcome email follows
 * once it's confirmed (/newsletter/confirm). The only exception is a
 * signed-in customer joining with their own account email - they already
 * proved they own it when signing in.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Each sign-up can send an email: limit per network and per address.
    const rate = await consumeRateLimits([
      // Per network: generous, as mobile networks share one IP among many shoppers.
      { key: `newsletter:ip:${getClientIp(req)}`, limit: 30, windowMs: HOUR_MS },
      { key: `newsletter:email:${email}`, limit: 3, windowMs: HOUR_MS },
    ]);

    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${describeWait(rate.retryAfterSeconds)}.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const settings = await getSettings();

    if (!settings.newsletterEnabled) {
      return NextResponse.json(
        { error: "Newsletter subscriptions are currently disabled." },
        { status: 403 }
      );
    }

    // Signed in with this very email: already verified, no confirm step.
    const user = await getCurrentUser().catch(() => null);

    if (user?.email && user.email.trim().toLowerCase() === email) {
      const activatedNow = await activateSubscriber(email);

      if (!activatedNow) {
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          message: "You are already subscribed to the MANGOSTA WORLD.",
        });
      }

      await clearMarketingOptOut(email);
      try {
        await sendNewsletterWelcome(email, settings);
        await sendNewsletterSignupAlert(email, settings);
      } catch (error) {
        // Subscribed either way; only the welcome email failed.
        console.error("[newsletter] Subscribed, but the welcome email could not be sent:", error);
      }

      return NextResponse.json({
        success: true,
        alreadySubscribed: false,
        message: "Welcome to the MANGOSTA WORLD.",
      });
    }

    // New, still waiting, or unsubscribed earlier: the owner confirms.
    // The reply is the same whether or not the address is already
    // subscribed, so the form doesn't reveal who is on the list.
    const { status } = await requestSubscription(email);

    if (status !== "active") {
      await sendNewsletterConfirmEmail(email);
    }

    return NextResponse.json({
      success: true,
      alreadySubscribed: false,
      confirmationSent: true,
      message: "Check your inbox: if this email isn't subscribed yet, we've sent a link to confirm.",
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);

    return NextResponse.json(
      { error: "Unable to complete your subscription right now. Please try again." },
      { status: 500 }
    );
  }
}

import "server-only";
import { getSettings } from "@/app/lib/dataStore";
import { activateSubscriber } from "@/app/lib/newsletterStore";
import {
  clearMarketingOptOut,
  isValidNewsletterConfirmToken,
} from "@/app/lib/emailPreferences";
import {
  sendNewsletterSignupAlert,
  sendNewsletterWelcome,
} from "@/app/lib/newsletterEmails";

/**
 * The owner pressed "Confirm" on the page opened from the confirm email.
 * Activates the subscription, removes any earlier opt-out and sends the
 * welcome email (once). Returns false for an invalid link.
 */
export async function confirmNewsletterFromLink(email: string, token: string): Promise<boolean> {
  const address = email.trim().toLowerCase();
  if (!isValidNewsletterConfirmToken(address, token)) return false;

  const activatedNow = await activateSubscriber(address);
  await clearMarketingOptOut(address);

  if (activatedNow) {
    try {
      const settings = await getSettings();
      await sendNewsletterWelcome(address, settings);
      await sendNewsletterSignupAlert(address, settings);
    } catch (error) {
      // Subscribed either way; only the welcome email failed.
      console.error("[newsletter] Confirmed, but the welcome email could not be sent:", error);
    }
  }

  return true;
}

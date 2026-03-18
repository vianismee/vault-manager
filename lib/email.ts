/**
 * Email client using Resend
 *
 * To use custom emails instead of Supabase defaults:
 * 1. Install Resend: npm install resend
 * 2. Set RESEND_API_KEY in .env.local
 * 3. Update your auth flow to call the send-email API
 */

import { Resend } from "resend";

// Lazy instantiation to avoid errors during build when API key is not set
let resendInstance: Resend | null = null;

export function getResendClient() {
  if (!resendInstance && process.env.RESEND_API_KEY) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Legacy export for backward compatibility
export const resend = new Proxy({} as Resend, {
  get(target, prop) {
    const client = getResendClient();
    if (!client) {
      throw new Error("Resend client not initialized. Set RESEND_API_KEY environment variable.");
    }
    return client[prop as keyof Resend];
  },
});

/**
 * Example usage in your auth flow:
 *
 * // Instead of supabase.auth.signInWithOtp(), use:
 * await fetch('/api/send-email', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     type: 'magic',
 *     to: email,
 *     data: { link: magicLinkUrl }
 *   })
 * });
 */

/**
 * Email types supported
 */
export type EmailType = "magic" | "confirm" | "reset" | "welcome";

/**
 * Send email helper
 */
export async function sendEmail(
  type: EmailType,
  to: string,
  data: { link?: string }
) {
  "use server";

  const {
    magicLinkTemplate,
    confirmEmailTemplate,
    passwordResetTemplate,
    welcomeTemplate,
  } = await import("@/emails/templates");

  let html: string;
  let subject: string;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vault.app";

  switch (type) {
    case "magic":
      html = magicLinkTemplate(to, data.link || "", { appUrl });
      subject = "Sign in to Vault";
      break;
    case "confirm":
      html = confirmEmailTemplate(to, data.link || "", { appUrl });
      subject = "Confirm your email address";
      break;
    case "reset":
      html = passwordResetTemplate(to, data.link || "", { appUrl });
      subject = "Reset your password";
      break;
    case "welcome":
      html = welcomeTemplate(to, { appUrl });
      subject = "Welcome to Vault!";
      break;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set. Email would be:", { subject, to });
    return { success: true, mock: true };
  }

  const { error } = await resend.emails.send({
    from: "Vault <noreply@vault.app>",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Email error:", error);
    return { success: false, error };
  }

  return { success: true };
}

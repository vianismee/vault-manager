import { NextResponse } from "next/server";
import { resend } from "@/lib/email";
import {
  magicLinkTemplate,
  confirmEmailTemplate,
  passwordResetTemplate,
  welcomeTemplate,
} from "@/emails/templates";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, to, data: emailData } = body;

    if (!to || !type) {
      return NextResponse.json(
        { error: "Missing required fields: to, type" },
        { status: 400 }
      );
    }

    let html: string;
    let subject: string;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vault.app";

    switch (type) {
      case "magic":
        html = magicLinkTemplate(to, emailData.link, { appUrl });
        subject = "Sign in to Vault";
        break;

      case "confirm":
        html = confirmEmailTemplate(to, emailData.link, { appUrl });
        subject = "Confirm your email address";
        break;

      case "reset":
        html = passwordResetTemplate(to, emailData.link, { appUrl });
        subject = "Reset your password";
        break;

      case "welcome":
        html = welcomeTemplate(to, { appUrl });
        subject = "Welcome to Vault!";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid email type" },
          { status: 400 }
        );
    }

    // Send email using Resend
    const { data: responseData, error } = await resend.emails.send({
      from: "Vault <noreply@vault.app>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Email error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: responseData?.id });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

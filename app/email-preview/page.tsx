"use client";

import { useState } from "react";
import {
  magicLinkTemplate,
  confirmEmailTemplate,
  passwordResetTemplate,
  welcomeTemplate,
} from "@/emails/templates";
import { Lock, Mail, Key, Shield } from "lucide-react";

type EmailType = "magic" | "confirm" | "reset" | "welcome";

export default function EmailPreviewPage() {
  const [emailType, setEmailType] = useState<EmailType>("magic");
  const [email, setEmail] = useState("user@example.com");

  const getEmailTemplate = () => {
    const appUrl = "http://localhost:3000";

    switch (emailType) {
      case "magic":
        return magicLinkTemplate(email, `${appUrl}/auth/callback?code=mock_code`, { appUrl });
      case "confirm":
        return confirmEmailTemplate(email, `${appUrl}/auth/verify?token=mock_token`, { appUrl });
      case "reset":
        return passwordResetTemplate(email, `${appUrl}/auth/reset?token=mock_token`, { appUrl });
      case "welcome":
        return welcomeTemplate(email, { appUrl });
    }
  };

  const tabs = [
    { id: "magic" as EmailType, label: "Magic Link", icon: Mail },
    { id: "confirm" as EmailType, label: "Confirmation", icon: Shield },
    { id: "reset" as EmailType, label: "Password Reset", icon: Key },
    { id: "welcome" as EmailType, label: "Welcome", icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg">Vault — Email Templates</span>
          </div>
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to site
          </a>
        </div>
      </nav>

      {/* Controls */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Email type tabs */}
            <div className="flex gap-1 p-1 bg-background border border-border rounded-lg">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setEmailType(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      emailType === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Email input */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Test email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm min-w-[250px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Email preview */}
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-border">
            <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-muted-foreground font-mono">
                  {emailType}@vault.app
                </span>
              </div>
            </div>
            <div className="bg-white">
              <iframe
                key={emailType}
                srcDoc={getEmailTemplate()}
                className="w-full h-[700px]"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-6 bg-muted/30 rounded-xl border border-border">
            <h3 className="font-display text-lg mb-3">How to use these templates</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Option 1: Supabase Dashboard</strong>
                <br />
                Go to your Supabase project → Authentication → Email Templates and customize the HTML
                using the templates in <code className="px-2 py-1 bg-background rounded">emails/templates.ts</code>
              </p>
              <p>
                <strong className="text-foreground">Option 2: Custom Email Service</strong>
                <br />
                Use an API route with Resend/SendGrid to send these templates. Create <code className="px-2 py-1 bg-background rounded">app/api/send-email/route.ts</code>
              </p>
              <p>
                <strong className="text-foreground">Option 3: Supabase Edge Function</strong>
                <br />
                Deploy the templates as a Supabase Edge Function to handle custom email sending.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

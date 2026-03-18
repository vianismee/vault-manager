/**
 * Email Templates for Vault
 * Matching Anthropic/Apple design system
 */

interface EmailContext {
  appName?: string;
  appUrl?: string;
  supportEmail?: string;
  year?: number;
}

const DEFAULT_CONTEXT: EmailContext = {
  appName: "Vault",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://vault.app",
  supportEmail: "support@vault.app",
  year: new Date().getFullYear(),
};

/**
 * Base email styles - matching the landing page design
 */
const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: #fafafa;
    color: #1a1a1a;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .email-wrapper {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .email-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e5e5e5;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }
  .email-header {
    background: #e67c50;
    padding: 24px 32px;
    text-align: center;
  }
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
  }
  .logo-icon {
    width: 32px;
    height: 32px;
    background: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-text {
    color: white;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .email-body {
    padding: 40px 32px;
  }
  .email-heading {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 16px;
    color: #1a1a1a;
  }
  .email-text {
    font-size: 15px;
    color: #666666;
    margin-bottom: 24px;
    line-height: 1.7;
  }
  .email-button {
    display: inline-block;
    background: #e67c50;
    color: white;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    text-align: center;
  }
  .email-button:hover {
    background: #d66a40;
  }
  .email-divider {
    height: 1px;
    background: #e5e5e5;
    margin: 32px 0;
  }
  .email-footer {
    padding: 24px 32px;
    background: #fafafa;
    text-align: center;
    font-size: 13px;
    color: #999999;
  }
  .email-footer a {
    color: #666666;
    text-decoration: none;
  }
  .email-footer a:hover {
    color: #e67c50;
  }
  .code-box {
    background: #f5f5f5;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.1em;
    margin: 24px 0;
  }
  .warning-box {
    background: #fff8f0;
    border: 1px solid #f0e0d0;
    border-radius: 8px;
    padding: 16px;
    margin: 24px 0;
  }
  .warning-text {
    font-size: 14px;
    color: #8b5a3c;
    line-height: 1.6;
  }
`;

/**
 * Magic Link Email Template
 */
export function magicLinkTemplate(email: string, magicLink: string, context: EmailContext = {}): string {
  const ctx = { ...DEFAULT_CONTEXT, ...context };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${ctx.appName}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-card">
      <div class="email-header">
        <a href="${ctx.appUrl}" class="logo">
          <div class="logo-icon">
            <svg width="16" height="16 viewBox="0 0 24 24" fill="none" stroke="#e67c50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span class="logo-text">${ctx.appName}</span>
        </a>
      </div>

      <div class="email-body">
        <h1 class="email-heading">Sign in to ${ctx.appName}</h1>

        <p class="email-text">
          We received a request to sign in to your ${ctx.appName} account using
          <strong>${email}</strong>. Click the button below to complete the sign-in process.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${magicLink}" class="email-button">
            Sign in to ${ctx.appName}
          </a>
        </div>

        <p class="email-text" style="font-size: 13px; color: #999999;">
          If the button above doesn't work, you can copy and paste the link below into your browser:
        </p>

        <div class="code-box" style="font-size: 11px; padding: 12px; word-break: break-all;">
          ${magicLink}
        </div>

        <div class="warning-box">
          <p class="warning-text">
            <strong>This link will expire in 1 hour.</strong><br>
            If you didn't request this sign-in link, please ignore this email or contact
            <a href="mailto:${ctx.supportEmail}" style="color: #e67c50;">support</a> if you have concerns.
          </p>
        </div>
      </div>

      <div class="email-footer">
        <p style="margin-bottom: 8px;">
          © ${ctx.year} ${ctx.appName}. Your passwords, privately yours.
        </p>
        <p>
          <a href="${ctx.appUrl}/privacy">Privacy</a> •
          <a href="${ctx.appUrl}/terms">Terms</a> •
          <a href="${ctx.appUrl}/security">Security</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Email Confirmation Template (for signup)
 */
export function confirmEmailTemplate(email: string, confirmLink: string, context: EmailContext = {}): string {
  const ctx = { ...DEFAULT_CONTEXT, ...context };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-card">
      <div class="email-header">
        <a href="${ctx.appUrl}" class="logo">
          <div class="logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67c50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span class="logo-text">${ctx.appName}</span>
        </a>
      </div>

      <div class="email-body">
        <h1 class="email-heading">Confirm your email address</h1>

        <p class="email-text">
          Welcome to ${ctx.appName}! We're excited to have you aboard.
          Please confirm your email address to complete your account setup.
        </p>

        <p class="email-text">
          You signed up with <strong>${email}</strong>. If this wasn't you, please ignore this email.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${confirmLink}" class="email-button">
            Confirm your email
          </a>
        </div>

        <p class="email-text" style="font-size: 13px; color: #999999;">
          If the button above doesn't work, you can copy and paste the link below into your browser:
        </p>

        <div class="code-box" style="font-size: 11px; padding: 12px; word-break: break-all;">
          ${confirmLink}
        </div>

        <div class="warning-box">
          <p class="warning-text">
            <strong>This confirmation link will expire in 24 hours.</strong>
          </p>
        </div>
      </div>

      <div class="email-footer">
        <p style="margin-bottom: 8px;">
          © ${ctx.year} ${ctx.appName}. Your passwords, privately yours.
        </p>
        <p>
          <a href="${ctx.appUrl}/privacy">Privacy</a> •
          <a href="${ctx.appUrl}/terms">Terms</a> •
          <a href="${ctx.appUrl}/security">Security</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Password Reset Template
 */
export function passwordResetTemplate(email: string, resetLink: string, context: EmailContext = {}): string {
  const ctx = { ...DEFAULT_CONTEXT, ...context };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-card">
      <div class="email-header">
        <a href="${ctx.appUrl}" class="logo">
          <div class="logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67c50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span class="logo-text">${ctx.appName}</span>
        </a>
      </div>

      <div class="email-body">
        <h1 class="email-heading">Reset your password</h1>

        <p class="email-text">
          We received a request to reset the password for your ${ctx.appName} account
          associated with <strong>${email}</strong>.
        </p>

        <p class="email-text">
          Click the button below to create a new password:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" class="email-button">
            Reset your password
          </a>
        </div>

        <p class="email-text" style="font-size: 13px; color: #999999;">
          If the button above doesn't work, you can copy and paste the link below into your browser:
        </p>

        <div class="code-box" style="font-size: 11px; padding: 12px; word-break: break-all;">
          ${resetLink}
        </div>

        <div class="warning-box">
          <p class="warning-text">
            <strong>This link will expire in 1 hour.</strong><br>
            If you didn't request a password reset, please ignore this email or contact
            <a href="mailto:${ctx.supportEmail}" style="color: #e67c50;">support</a> immediately.
          </p>
        </div>
      </div>

      <div class="email-footer">
        <p style="margin-bottom: 8px;">
          © ${ctx.year} ${ctx.appName}. Your passwords, privately yours.
        </p>
        <p>
          <a href="${ctx.appUrl}/privacy">Privacy</a> •
          <a href="${ctx.appUrl}/terms">Terms</a> •
          <a href="${ctx.appUrl}/security">Security</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Welcome Email Template (after confirmation)
 */
export function welcomeTemplate(email: string, context: EmailContext = {}): string {
  const ctx = { ...DEFAULT_CONTEXT, ...context };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${ctx.appName}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-card">
      <div class="email-header">
        <a href="${ctx.appUrl}" class="logo">
          <div class="logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67c50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span class="logo-text">${ctx.appName}</span>
        </a>
      </div>

      <div class="email-body">
        <h1 class="email-heading">Welcome to ${ctx.appName}! 👋</h1>

        <p class="email-text">
          Your account has been successfully created and verified.
          You're now ready to securely store and manage your passwords.
        </p>

        <div class="email-divider"></div>

        <p class="email-text" style="margin-bottom: 12px;">
          <strong>Here's what you can do now:</strong>
        </p>

        <p class="email-text" style="margin-bottom: 8px;">
          📱 <strong>Add your passwords</strong> — Import from your browser or add manually
        </p>
        <p class="email-text" style="margin-bottom: 8px;">
          🔐 <strong>Enable 2FA</strong> — Store TOTP secrets for one-time codes
        </p>
        <p class="email-text" style="margin-bottom: 8px;">
          🛡️ <strong>Stay secure</strong> — Your data is encrypted with AES-256
        </p>

        <div class="email-divider"></div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${ctx.appUrl}/vault" class="email-button">
            Go to your vault
          </a>
        </div>

        <p class="email-text">
          If you have any questions, don't hesitate to reach out to our
          <a href="mailto:${ctx.supportEmail}" style="color: #e67c50;">support team</a>.
        </p>
      </div>

      <div class="email-footer">
        <p style="margin-bottom: 8px;">
          © ${ctx.year} ${ctx.appName}. Your passwords, privately yours.
        </p>
        <p>
          <a href="${ctx.appUrl}/privacy">Privacy</a> •
          <a href="${ctx.appUrl}/terms">Terms</a> •
          <a href="${ctx.appUrl}/security">Security</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

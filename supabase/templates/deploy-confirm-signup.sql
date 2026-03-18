-- Update Confirm Signup Email Template
UPDATE auth.email_templates
SET
  template_content = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email - Vault</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: #f5f2ef;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #e67c50 0%, #d4653b 100%);
      padding: 32px;
      text-align: center;
    }
    .logo {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo svg {
      width: 24px;
      height: 24px;
      fill: #ffffff;
    }
    .header h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 500;
      color: #1a1a1a;
      margin: 0 0 8px;
    }
    .message {
      color: #5a5a5a;
      font-size: 15px;
      margin: 0 0 24px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #e67c50 0%, #d4653b 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-weight: 500;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(230, 124, 80, 0.3);
    }
    .button:hover {
      opacity: 0.9;
    }
    .divider {
      text-align: center;
      margin: 24px 0;
      position: relative;
    }
    .divider::before {
      content: '''';
      position: absolute;
      left: 0;
      top: 50%;
      width: 100%;
      height: 1px;
      background: #e5e5e5;
    }
    .divider span {
      background: #ffffff;
      padding: 0 16px;
      position: relative;
      color: #9a9a9a;
      font-size: 13px;
    }
    .link {
      text-align: center;
      font-size: 12px;
      color: #9a9a9a;
      word-break: break-all;
    }
    .link a {
      color: #e67c50;
      text-decoration: none;
    }
    .footer {
      background: #f9f7f5;
      padding: 24px 32px;
      text-align: center;
    }
    .footer p {
      font-size: 13px;
      color: #7a7a7a;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd"/>
        </svg>
      </div>
      <h1>Verify your email</h1>
    </div>
    <div class="content">
      <p class="greeting">Welcome to Vault!</p>
      <p class="message">
        Thanks for signing up! We just need to verify your email address before you can start using your secure password vault.
      </p>
      <div class="button-container">
        <a href="{{ .ConfirmationURL }}" class="button">Verify Email Address</a>
      </div>
      <div class="divider"><span>or copy this link</span></div>
      <div class="link">
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </div>
    </div>
    <div class="footer">
      <p>Your passwords, privately yours.</p>
    </div>
  </div>
</body>
</html>',
  use_default = false
WHERE template_name = 'confirm_signup';

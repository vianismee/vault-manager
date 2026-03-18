# Vault Email Templates

Custom email templates for Supabase authentication, matching the Vault app's design system.

## Templates Included

1. **magic-link.html** - Passwordless sign-in email
2. **confirm-signup.html** - Email verification for new accounts
3. **reset-password.html** - Password reset email

## Deploying to Supabase

### Option 1: Via Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select the template type (Magic Link, Confirm Signup, or Reset Password)
4. Toggle "Use custom template"
5. Copy the contents of the corresponding HTML file
6. Paste into the editor
7. Click **Save**

### Option 2: Via SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of the corresponding `.sql` file
5. Run the query

The SQL files are:
- `deploy-magic-link.sql`
- `deploy-confirm-signup.sql`
- `deploy-reset-password.sql`

### Option 3: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the template updates
supabase db execute -f supabase/templates/deploy-magic-link.sql
supabase db execute -f supabase/templates/deploy-confirm-signup.sql
supabase db execute -f supabase/templates/deploy-reset-password.sql
```

## Template Variables

The templates use Supabase's built-in variables:

- `{{ .ConfirmationURL }}` - The magic link or confirmation URL
- `{{ .Email }}` - The user's email address
- `{{ .SiteURL }}` - Your application's URL

## Customization

To customize the templates:

1. Edit the HTML files directly
2. Update the corresponding SQL files with the new HTML content
3. Redeploy using one of the methods above

### Colors

The templates use Vault's terracotta color scheme:
- Primary: `#e67c50` (terracotta)
- Primary Dark: `#d4653b`
- Background: `#f5f2ef` (warm cream)
- Card Background: `#ffffff`

## Testing

To test email templates in development:

1. Run your local development server
2. Trigger an email (sign up, magic link, etc.)
3. Check the Supabase dashboard under **Authentication** → **Logs** to see the email content

## Email Deliverability

For production use, ensure:

1. **Sender email is verified** in Supabase dashboard
2. **SPF/DKIM records** are configured for your domain
3. **Reply-to address** is set appropriately

Configure these in **Settings** → **Authentication** → **Email**.

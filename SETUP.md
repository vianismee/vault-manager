# Setup Guide - Password Vault

Follow these steps to get your Password Vault up and running.

## 1. Supabase Setup

### Create Account & Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in project details:
   - **Name**: password-vault (or your choice)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to your users
4. Wait for project to be provisioned (~2 minutes)

### Configure Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/setup.sql` from this repo
4. Paste and click "Run" to create the credentials table and RLS policies

### Configure Authentication

1. Go to **Authentication** → **Providers**
2. Click on **Email**
3. Ensure "Enable Email provider" is toggled ON
4. Scroll down to **URL Configuration**
5. Add your site URL:
   - **Development**: `http://localhost:3000`
   - **Production**: `https://your-domain.com`
6. Add redirect URLs: `http://localhost:3000/auth/callback`

### Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Environment Setup

### Generate Encryption Key

Open your terminal and run:

```bash
# Using OpenSSL (recommended)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Create Environment File

```bash
# Copy the example file
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_ENCRYPTION_KEY=your-generated-32-char-key
```

## 3. Install & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 4. First Use

1. **Sign In**: Enter your email to receive a magic link
2. **Check Email**: Click the link in your email (check spam folder)
3. **Add Password**: Click "Add Password" to store your first credential
4. **Test TOTP**: Add a credential with a TOTP secret (e.g., from a test 2FA setup)

## 5. Production Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_ENCRYPTION_KEY
```

### Other Platforms

1. Build the project: `npm run build`
2. Deploy the `.next` folder
3. Set environment variables in your hosting platform

## Troubleshooting

### "Invalid API Key" Error
- Check your `.env.local` file has correct Supabase credentials
- Ensure you copied the full API key (no extra spaces)

### Magic Link Not Arriving
- Check spam/junk folder
- Verify Email provider is enabled in Supabase
- Check the redirect URL matches your site URL

### TOTP Not Working
- Ensure the TOTP secret is in base32 format
- Test with a known service (e.g., Google Authenticator test)
- Check the secret doesn't have extra spaces

### Database Errors
- Verify you ran the setup.sql script in Supabase SQL Editor
- Check RLS policies are enabled
- Ensure you're authenticated

## Security Best Practices

1. **Never commit** `.env.local` to version control
2. Use a **strong encryption key** (32+ characters)
3. Enable **2FA** on your Supabase account
4. Regular **backups** of your Supabase database
5. Use **environment-specific** keys for dev/prod

## Need Help?

- Check the [README.md](./README.md) for more details
- Review Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- Open an issue on GitHub

---

**Your Password Vault is now ready to use! 🔐**

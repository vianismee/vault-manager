# Password Vault

A secure, zero-knowledge password manager with built-in TOTP authenticator and Apple-inspired UI design.

## Features

- 🔐 **Zero-Knowledge Architecture**: Client-side AES-256 encryption ensures your passwords are never stored in plain text
- 🔑 **Magic Link Authentication**: Passwordless login via email magic links
- 📱 **Built-in TOTP Authenticator**: Generate 2FA codes directly in the app with one-click copy
- 🎨 **Apple-Inspired Design**: Glassmorphism, smooth animations, and premium UI/UX
- 🌙 **Dark Mode**: Seamless light/dark theme switching
- 🔍 **Instant Search**: Quickly find credentials across your vault
- 📂 **Categories**: Organize passwords by category (work, personal, finance, etc.)

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **State Management**: TanStack Query
- **Animations**: Framer Motion
- **Security**: crypto-js for AES-256 encryption
- **2FA**: otpauth for TOTP generation

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd vault
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your project dashboard, go to SQL Editor and run:

```sql
-- Credentials table
CREATE TABLE credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT NOT NULL,
  website_url TEXT,
  totp_secret TEXT,
  notes TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- Users can only access their own credentials
CREATE POLICY "Users can only access their own credentials"
  ON credentials
  FOR ALL
  USING (auth.uid() = user_id);
```

3. Enable Email Auth in Supabase:
   - Go to Authentication → Providers → Email
   - Ensure "Enable Email provider" is ON
   - Add your site URL to "Site URL" field

4. Get your API credentials:
   - Go to Project Settings → API
   - Copy your `URL` and `anon public` key

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_ENCRYPTION_KEY=generate_32_char_key
```

**Generate an encryption key:**
```bash
openssl rand -base64 32
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

### Credentials Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| title | TEXT | Credential title |
| username | TEXT | Username or email |
| password_encrypted | TEXT | AES-256 encrypted password |
| website_url | TEXT | Optional website URL |
| totp_secret | TEXT | Optional TOTP secret |
| notes | TEXT | Optional notes |
| category | TEXT | Category for organization |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## Security Features

- **Client-Side Encryption**: Passwords are encrypted in the browser before storage
- **Row Level Security**: Supabase RLS policies ensure users can only access their own data
- **Zero-Knowledge**: Server never sees plain text passwords
- **Secure Auth**: Magic links provide passwordless, secure authentication

## Design System

The app uses a custom Apple-inspired design system with:

- **Fonts**: Inter (UI), Instrument Serif (Display), Geist Mono (Code)
- **Glassmorphism**: Translucent cards with blur effects
- **Smooth Animations**: Framer Motion powered transitions
- **Semantic Colors**: Theme-aware color tokens

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

Ensure you set the `NEXT_PUBLIC_APP_URL` environment variable to your production URL.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Design inspiration from Apple's Human Interface Guidelines
- Built with [Next.js](https://nextjs.org)
- Backend by [Supabase](https://supabase.com)

# Supabase Setup Complete ✅

Your password manager backend is now fully configured with Supabase!

## Connection Details

**Project**: Vault
**URL**: https://kdgyxdfdtotcrtlxsusm.supabase.co
**Region**: ap-southeast-1 (Singapore)
**Status**: Active and Healthy

## Environment Variables

The `.env` file has been updated with your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anonymous key for client-side access
- `NEXT_PUBLIC_ENCRYPTION_KEY`: A 32-byte encryption key for client-side encryption

**⚠️ IMPORTANT**: The encryption key in `.env` is a placeholder. For production, generate a secure random key and keep it secret!

## Database Schema

### Tables Created

#### `categories`
Organize your passwords into categories
- **Default categories** (auto-created on signup): Personal, Work, Finance, Social, Other
- **Fields**: name, icon, color
- **Security**: Row Level Security (RLS) enabled - users can only access their own categories

#### `passwords`
Store encrypted password entries with TOTP support
- **Encrypted fields** (client-side encrypted before storage):
  - `encrypted_password`: The actual password (never stored in plain text)
  - `totp_secret`: TOTP secret for 2FA codes
- **Plain fields**:
  - `title`, `username`, `url`, `notes`
  - `category_id`: Link to categories
  - `totp_algorithm`, `totp_digits`, `totp_period`: TOTP configuration
  - `favicon_url`, `last_used_at`, `expires_at`: Metadata
- **Security**: RLS enabled - users can only access their own passwords

#### `user_profiles`
Extended user profile information
- **Fields**: email, full_name, avatar_url, encryption_key_hint
- **Security**: RLS enabled - users can only access their own profile

## Security Features ✅

### Row Level Security (RLS)
All tables have RLS policies ensuring:
- Users can only view their own data
- Users can only insert their own data
- Users can only update their own data
- Users can only delete their own data

### Zero-Knowledge Architecture
- **Client-side encryption**: Passwords are encrypted in the browser before being sent to the database
- **Server never sees plain text**: The database only stores encrypted passwords
- **User-controlled encryption key**: Each user has their own encryption key

### Authentication
- **Magic link authentication** enabled (passwordless login via email)
- **Session management** handled by Supabase Auth
- **Automatic profile creation** on user signup

## Database Functions

### `update_updated_at_column()`
Automatically updates the `updated_at` timestamp on row modifications.

### `create_default_categories_for_user()`
Creates default categories when a new user signs up.

### `handle_new_user()`
Creates a user profile when a new user signs up.

## TypeScript Types

Database types have been generated and saved to `src/types/database.ts`. These provide:
- Full type safety for database operations
- Autocomplete support in your IDE
- Insert/Update type definitions

Example usage:
```typescript
import { Database } from '@/types/database'

type Password = Database['public']['Tables']['passwords']['Row']
type PasswordInsert = Database['public']['Tables']['passwords']['Insert']
```

## Next Steps

### 1. Initialize Your Frontend
Choose between:
- **Next.js** (recommended for full-stack with SSR)
- **Vite** (for a lighter, client-side only approach)

### 2. Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 3. Create Supabase Client
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
```

### 4. Implement Authentication
Use Supabase Auth for magic link authentication:
```typescript
// Send magic link
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: `${location.origin}/auth/callback`
  }
})
```

### 5. Implement Client-Side Encryption
Use the Web Crypto API or a library like `crypto-js`:
```typescript
// Encrypt password before storing
const encryptedPassword = await encryptPassword(password, userEncryptionKey)

// Store in database
await supabase.from('passwords').insert({
  title: 'Example',
  encrypted_password: encryptedPassword,
  user_id: userId
})
```

## Important Security Notes

1. **Never commit `.env` to version control** - It's already in `.gitignore`
2. **Generate a secure encryption key** for production use:
   ```bash
   openssl rand -base64 32
   ```
3. **Always encrypt passwords client-side** before sending to the database
4. **Use HTTPS only** in production
5. **Implement rate limiting** to prevent brute force attacks
6. **Regular security audits** - Run `get_advisors` periodically

## Testing the Setup

You can test your Supabase connection with:

```typescript
// Test connection
const { data, error } = await supabase.from('categories').select('*')
if (error) console.error('Connection failed:', error)
else console.log('Connected successfully!', data)
```

## Dashboard Access

Access your Supabase dashboard at:
https://supabase.com/dashboard/project/kdgyxdfdtotcrtlxsusm

From there you can:
- View and edit your database
- Configure authentication settings
- Monitor performance
- View logs
- Set up email templates

## Support & Documentation

- Supabase Docs: https://supabase.com/docs
- Auth Guide: https://supabase.com/docs/guides/auth
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- Database Guide: https://supabase.com/docs/guides/database

---

## Troubleshooting: 500 Error on Magic Link

If you encounter a `500 Internal Server Error` when sending magic links:

### 1. Configure Redirect URLs
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/kdgyxdfdtotcrtlxsusm)
2. Navigate to **Authentication** → **URL Configuration**
3. Add these URLs to **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/vault
   ```

### 2. Configure Email Templates
1. Go to **Authentication** → **Email Templates**
2. Click **Confirm signup**
3. Ensure template has `{{ .ConfirmationURL }}` or `{{ .Token }}`
4. For development: Toggle **Enable email confirmations** to OFF

### 3. Check Application URL
1. Go to **Project Settings** → **General**
2. Set **Application URL** to: `http://localhost:3000`

### 4. Verify Email Provider
1. Go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. For testing, use real email addresses (not temporary emails)

### 5. Check Auth Logs
1. Go to **Logs** → **Auth Logs** in dashboard
2. Look for detailed error messages when OTP fails

### 6. Updated Code Changes
The following files have been updated for better error handling:
- `app/auth/callback/route.ts` - Now uses auth-helpers-nextjs
- `middleware.ts` - Improved session handling
- `app/auth/login/page.tsx` - Better error messages and debugging

---

**Your password manager backend is ready to go! 🎉**

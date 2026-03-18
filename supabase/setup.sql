-- Password Vault Database Setup
-- Run this in your Supabase SQL Editor

-- Drop any existing problematic triggers/functions first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create credentials table
CREATE TABLE IF NOT EXISTS credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT NOT NULL,
  website_url TEXT,
  totp_secret TEXT,
  notes TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own credentials" ON credentials;
DROP POLICY IF EXISTS "Users can insert their own credentials" ON credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON credentials;

-- Create RLS policies
CREATE POLICY "Users can view their own credentials"
  ON credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
  ON credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
  ON credentials
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
  ON credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS credentials_user_id_idx ON credentials(user_id);
CREATE INDEX IF NOT EXISTS credentials_category_idx ON credentials(category);

-- Grant necessary permissions
GRANT ALL ON credentials TO authenticated;
GRANT ALL ON credentials TO anon;

-- NOTE: The trigger has been removed because it was causing "Database error saving new user"
-- If you need to run custom logic when a user signs up, use Supabase Edge Functions or
-- a webhook instead of a trigger on auth.users
--
-- If you previously had the trigger installed, run this to remove it:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_user();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Password Vault database setup complete!';
END $$;

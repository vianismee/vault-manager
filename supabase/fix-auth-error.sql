-- Fix for "Database error saving new user" error
-- Run this in your Supabase SQL Editor if you're experiencing the auth error

-- Step 1: Remove the problematic trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 2: Verify credentials table exists (for app data, not auth)
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

-- Step 3: Enable Row Level Security
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own credentials" ON credentials;
DROP POLICY IF EXISTS "Users can insert their own credentials" ON credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON credentials;

-- Step 5: Create RLS policies
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

-- Step 6: Create index for faster queries
CREATE INDEX IF NOT EXISTS credentials_user_id_idx ON credentials(user_id);
CREATE INDEX IF NOT EXISTS credentials_category_idx ON credentials(category);

-- Step 7: Grant necessary permissions
GRANT ALL ON credentials TO authenticated;
GRANT ALL ON credentials TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Auth error fix applied successfully! The problematic trigger has been removed.';
END $$;

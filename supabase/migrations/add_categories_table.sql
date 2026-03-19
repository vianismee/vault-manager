-- ============================================
-- Categories Management Migration
-- ============================================

-- Drop existing tables/policies if they exist (for migration reruns)
DROP TABLE IF EXISTS shared_credentials CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ============================================
-- 1. Categories Table
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#e67c50',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique category names per user
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Users can view their own categories"
  ON categories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);
CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON categories(user_id, sort_order);

-- ============================================
-- 2. Update credentials table to reference categories
-- ============================================

-- Add category_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credentials' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE credentials ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS credentials_category_id_idx ON credentials(category_id);

-- Migrate existing category text values to proper categories
-- This will create a default category for each user's existing credentials
DO $$
DECLARE
  user_record RECORD;
  category_id UUID;
BEGIN
  FOR user_record IN
    SELECT DISTINCT user_id FROM credentials WHERE category IS NOT NULL AND category_id IS NULL
  LOOP
    -- Create a default "General" category for each user
    INSERT INTO categories (user_id, name, icon, color, sort_order)
    VALUES (
      user_record.user_id,
      COALESCE(
        (SELECT category FROM credentials WHERE user_id = user_record.user_id AND category IS NOT NULL LIMIT 1),
        'General'
      ),
      'folder',
      '#e67c50',
      0
    )
    ON CONFLICT (user_id, name) DO NOTHING
    RETURNING id INTO category_id;

    -- If the category was newly created, update credentials
    IF category_id IS NOT NULL THEN
      UPDATE credentials
      SET category_id = category_id
      WHERE user_id = user_record.user_id
        AND category_id IS NULL;
    END IF;

    category_id := NULL;
  END LOOP;

  -- For any remaining credentials without a category, assign them to a "General" category
  FOR user_record IN
    SELECT DISTINCT user_id FROM credentials WHERE category_id IS NULL
  LOOP
    INSERT INTO categories (user_id, name, icon, color, sort_order)
    VALUES (user_record.user_id, 'General', 'folder', '#e67c50', 0)
    ON CONFLICT (user_id, name) DO UPDATE SET NOTHING
    RETURNING id INTO category_id;

    UPDATE credentials
    SET category_id = category_id
    WHERE user_id = user_record.user_id AND category_id IS NULL;
  END LOOP;
END $$;

-- ============================================
-- 3. Shared Credentials Table (for Sharing feature)
-- ============================================
CREATE TABLE IF NOT EXISTS shared_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credential_id UUID REFERENCES credentials(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users NOT NULL,
  to_user_id UUID REFERENCES auth.users NOT NULL,
  to_email TEXT NOT NULL,
  permission TEXT DEFAULT 'view', -- 'view' or 'edit'
  encrypted_data TEXT, -- Re-encrypted for recipient
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'revoked'
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

  -- Ensure one share per credential per recipient
  UNIQUE(credential_id, to_user_id, status)
);

-- Enable Row Level Security
ALTER TABLE shared_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_credentials
CREATE POLICY "Users can view shares they sent or received"
  ON shared_credentials
  FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can insert shares they created"
  ON shared_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update shares they sent"
  ON shared_credentials
  FOR UPDATE
  USING (auth.uid() = from_user_id);

CREATE POLICY "Users can delete shares they sent"
  ON shared_credentials
  FOR DELETE
  USING (auth.uid() = from_user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS shared_credentials_from_user_idx ON shared_credentials(from_user_id);
CREATE INDEX IF NOT EXISTS shared_credentials_to_user_idx ON shared_credentials(to_user_id);
CREATE INDEX IF NOT EXISTS shared_credentials_status_idx ON shared_credentials(status);

-- ============================================
-- 4. Account Transfers Table (for Vault Transfer feature)
-- ============================================
CREATE TABLE IF NOT EXISTS account_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES auth.users NOT NULL,
  to_email TEXT NOT NULL,
  to_user_id UUID REFERENCES auth.users,
  encrypted_data TEXT NOT NULL, -- All credentials encrypted for transfer
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired', 'cancelled'
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Enable Row Level Security
ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_transfers
CREATE POLICY "Users can view transfers they initiated or received"
  ON account_transfers
  FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can insert transfers they created"
  ON account_transfers
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update transfers they initiated"
  ON account_transfers
  FOR UPDATE
  USING (auth.uid() = from_user_id);

CREATE POLICY "Users can delete transfers they initiated"
  ON account_transfers
  FOR DELETE
  USING (auth.uid() = from_user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS account_transfers_from_user_idx ON account_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS account_transfers_to_user_idx ON account_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS account_transfers_status_idx ON account_transfers(status);

-- ============================================
-- 5. Functions for automatic timestamp updates
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credentials_updated_at ON credentials;
CREATE TRIGGER update_credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shared_credentials_updated_at ON shared_credentials;
CREATE TRIGGER update_shared_credentials_updated_at
  BEFORE UPDATE ON shared_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Categories, Sharing, and Vault Transfer tables created successfully!';
END $$;

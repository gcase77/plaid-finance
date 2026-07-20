-- =====================================================================
-- Row Level Security (RLS) Policies for Supabase
-- =====================================================================
-- This file contains all RLS policies needed to secure your database.
-- Apply these policies via the Supabase SQL Editor.
--
-- IMPORTANT: RLS is already ENABLED on all tables via migration
-- 20260301014721_rls_user_sync_func. This file only creates the policies.
-- =====================================================================

-- =====================================================================
-- Step 1: Link users table to auth.users (if not already done)
-- =====================================================================
-- This foreign key ensures that user_id values in the users table
-- correspond to actual Supabase Auth users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_id_fkey'
  ) THEN
    ALTER TABLE "public"."users"
      ADD CONSTRAINT "users_id_fkey"
      FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================================
-- Step 2: Create helper function to get authenticated user ID
-- =====================================================================
-- This function extracts the user ID from the JWT claims.
-- It works with both Supabase Auth JWTs and custom JWT claims set by
-- Prisma transactions.

CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$;

-- =====================================================================
-- Step 3: Create RLS policies for each table
-- =====================================================================

-- Users table policies
-- Users can only see and modify their own user record
DROP POLICY IF EXISTS "Users can view own record" ON "public"."users";
CREATE POLICY "Users can view own record"
  ON "public"."users"
  FOR SELECT
  USING (id = auth.user_id());

DROP POLICY IF EXISTS "Users can update own record" ON "public"."users";
CREATE POLICY "Users can update own record"
  ON "public"."users"
  FOR UPDATE
  USING (id = auth.user_id())
  WITH CHECK (id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own record" ON "public"."users";
CREATE POLICY "Users can insert own record"
  ON "public"."users"
  FOR INSERT
  WITH CHECK (id = auth.user_id());

-- Items table policies
-- Users can only access their own items
DROP POLICY IF EXISTS "Users can view own items" ON "public"."items";
CREATE POLICY "Users can view own items"
  ON "public"."items"
  FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own items" ON "public"."items";
CREATE POLICY "Users can insert own items"
  ON "public"."items"
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can update own items" ON "public"."items";
CREATE POLICY "Users can update own items"
  ON "public"."items"
  FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can delete own items" ON "public"."items";
CREATE POLICY "Users can delete own items"
  ON "public"."items"
  FOR DELETE
  USING (user_id = auth.user_id());

-- Accounts table policies
-- Users can only access their own accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON "public"."accounts";
CREATE POLICY "Users can view own accounts"
  ON "public"."accounts"
  FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own accounts" ON "public"."accounts";
CREATE POLICY "Users can insert own accounts"
  ON "public"."accounts"
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can update own accounts" ON "public"."accounts";
CREATE POLICY "Users can update own accounts"
  ON "public"."accounts"
  FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can delete own accounts" ON "public"."accounts";
CREATE POLICY "Users can delete own accounts"
  ON "public"."accounts"
  FOR DELETE
  USING (user_id = auth.user_id());

-- Transactions table policies
-- Users can only access their own transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON "public"."transactions";
CREATE POLICY "Users can view own transactions"
  ON "public"."transactions"
  FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own transactions" ON "public"."transactions";
CREATE POLICY "Users can insert own transactions"
  ON "public"."transactions"
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can update own transactions" ON "public"."transactions";
CREATE POLICY "Users can update own transactions"
  ON "public"."transactions"
  FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can delete own transactions" ON "public"."transactions";
CREATE POLICY "Users can delete own transactions"
  ON "public"."transactions"
  FOR DELETE
  USING (user_id = auth.user_id());

-- Transaction meta table policies
-- Access controlled through transaction relationship
DROP POLICY IF EXISTS "Users can view own transaction meta" ON "public"."transaction_meta";
CREATE POLICY "Users can view own transaction meta"
  ON "public"."transaction_meta"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."transactions"
      WHERE "transactions"."id" = "transaction_meta"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert own transaction meta" ON "public"."transaction_meta";
CREATE POLICY "Users can insert own transaction meta"
  ON "public"."transaction_meta"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."transactions"
      WHERE "transactions"."id" = "transaction_meta"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

DROP POLICY IF EXISTS "Users can update own transaction meta" ON "public"."transaction_meta";
CREATE POLICY "Users can update own transaction meta"
  ON "public"."transaction_meta"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."transactions"
      WHERE "transactions"."id" = "transaction_meta"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."transactions"
      WHERE "transactions"."id" = "transaction_meta"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

DROP POLICY IF EXISTS "Users can delete own transaction meta" ON "public"."transaction_meta";
CREATE POLICY "Users can delete own transaction meta"
  ON "public"."transaction_meta"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."transactions"
      WHERE "transactions"."id" = "transaction_meta"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

-- Transaction tags table policies
-- Access controlled through transaction relationship
DROP POLICY IF EXISTS "Users can view own transaction tags" ON "public"."transaction_tags";
CREATE POLICY "Users can view own transaction tags"
  ON "public"."transaction_tags"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."transaction_meta"
      JOIN "public"."transactions" ON "transactions"."id" = "transaction_meta"."transaction_id"
      WHERE "transaction_meta"."transaction_id" = "transaction_tags"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert own transaction tags" ON "public"."transaction_tags";
CREATE POLICY "Users can insert own transaction tags"
  ON "public"."transaction_tags"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."transaction_meta"
      JOIN "public"."transactions" ON "transactions"."id" = "transaction_meta"."transaction_id"
      WHERE "transaction_meta"."transaction_id" = "transaction_tags"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

DROP POLICY IF EXISTS "Users can delete own transaction tags" ON "public"."transaction_tags";
CREATE POLICY "Users can delete own transaction tags"
  ON "public"."transaction_tags"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."transaction_meta"
      JOIN "public"."transactions" ON "transactions"."id" = "transaction_meta"."transaction_id"
      WHERE "transaction_meta"."transaction_id" = "transaction_tags"."transaction_id"
        AND "transactions"."user_id" = auth.user_id()
    )
  );

-- Tags table policies
-- Users can only access their own tags
DROP POLICY IF EXISTS "Users can view own tags" ON "public"."tags";
CREATE POLICY "Users can view own tags"
  ON "public"."tags"
  FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own tags" ON "public"."tags";
CREATE POLICY "Users can insert own tags"
  ON "public"."tags"
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can update own tags" ON "public"."tags";
CREATE POLICY "Users can update own tags"
  ON "public"."tags"
  FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can delete own tags" ON "public"."tags";
CREATE POLICY "Users can delete own tags"
  ON "public"."tags"
  FOR DELETE
  USING (user_id = auth.user_id());

-- Budget rules table policies
-- Users can only access their own budget rules
DROP POLICY IF EXISTS "Users can view own budget rules" ON "public"."budget_rules";
CREATE POLICY "Users can view own budget rules"
  ON "public"."budget_rules"
  FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own budget rules" ON "public"."budget_rules";
CREATE POLICY "Users can insert own budget rules"
  ON "public"."budget_rules"
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can update own budget rules" ON "public"."budget_rules";
CREATE POLICY "Users can update own budget rules"
  ON "public"."budget_rules"
  FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can delete own budget rules" ON "public"."budget_rules";
CREATE POLICY "Users can delete own budget rules"
  ON "public"."budget_rules"
  FOR DELETE
  USING (user_id = auth.user_id());

-- System logs table policies
-- Users can only access their own logs
DROP POLICY IF EXISTS "Users can view own system logs" ON "public"."system_logs";
CREATE POLICY "Users can view own system logs"
  ON "public"."system_logs"
  FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "Users can insert own system logs" ON "public"."system_logs";
CREATE POLICY "Users can insert own system logs"
  ON "public"."system_logs"
  FOR INSERT
  WITH CHECK (user_id = auth.user_id());

-- System logs are append-only (no UPDATE or DELETE for users)

-- =====================================================================
-- Step 4: Grant necessary permissions to authenticated users
-- =====================================================================
-- Ensure authenticated users can execute the helper function

GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;

-- =====================================================================
-- Verification queries (run these to confirm policies are active)
-- =====================================================================
-- 
-- Check that RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- List all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- =====================================================================

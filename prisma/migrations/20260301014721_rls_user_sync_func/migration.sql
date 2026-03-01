-- Step 1: Rename username to email
ALTER TABLE "users" RENAME COLUMN "username" TO "email";

-- Step 2: Drop FK constraints referencing users.id (required before type change)
ALTER TABLE "items" DROP CONSTRAINT "items_user_id_fkey";
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";
ALTER TABLE "tags" DROP CONSTRAINT "tags_user_id_fkey";
ALTER TABLE "budget_rules" DROP CONSTRAINT "budget_rules_user_id_fkey";
ALTER TABLE "system_logs" DROP CONSTRAINT "system_logs_user_id_fkey";

-- Step 3: Change users.id and all user_id columns from TEXT to UUID
ALTER TABLE "users" ALTER COLUMN "id" TYPE UUID USING "id"::UUID;
ALTER TABLE "items" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::UUID;
ALTER TABLE "accounts" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::UUID;
ALTER TABLE "transactions" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::UUID;
ALTER TABLE "tags" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::UUID;
ALTER TABLE "budget_rules" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::UUID;
ALTER TABLE "system_logs" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::UUID;

-- Step 4: Re-add FK constraints (preserving original ON DELETE/UPDATE behavior)
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Step 5: Enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_meta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;

-- Steps 6 & 7 (RLS policies, FK to auth.users, trigger) must be applied manually
-- via the Supabase SQL editor — Prisma's shadow database has no auth schema.
-- See README for the SQL to run.

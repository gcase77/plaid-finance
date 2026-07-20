-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_subscription_status" TEXT NOT NULL DEFAULT 'none',
    "access_level" INTEGER NOT NULL DEFAULT 1,
    "free_sync_used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Backfill free-tier rows for existing users
INSERT INTO "subscriptions" ("user_id", "stripe_subscription_status", "access_level", "free_sync_used")
SELECT "id", 'none', 1, false FROM "users"
ON CONFLICT ("user_id") DO NOTHING;

-- Auto-create a free-tier subscription whenever a public.users row is inserted
CREATE OR REPLACE FUNCTION public.create_subscription_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, stripe_subscription_status, access_level, free_sync_used)
  VALUES (NEW.id, 'none', 1, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_subscription ON public.users;
CREATE TRIGGER on_user_created_subscription
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_subscription_for_user();

-- RLS: enabled with no write policies → clients cannot insert/update/delete
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

-- Apply in Supabase SQL editor (Prisma shadow DB has no auth schema):
-- CREATE POLICY "subscriptions_select_own"
--   ON public.subscriptions
--   FOR SELECT
--   TO authenticated
--   USING (auth.uid() = user_id);

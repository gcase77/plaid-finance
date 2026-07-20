-- Rename Stripe status column and add entitlement fields
ALTER TABLE "subscriptions" RENAME COLUMN "status" TO "stripe_subscription_status";
ALTER TABLE "subscriptions" ADD COLUMN "access_level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscriptions" ADD COLUMN "free_sync_used" BOOLEAN NOT NULL DEFAULT false;

-- Backfill free-tier rows for existing users missing a subscription
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

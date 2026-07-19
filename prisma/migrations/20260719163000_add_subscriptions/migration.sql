-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- RLS: enabled with no write policies → clients cannot insert/update/delete
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

-- Apply in Supabase SQL editor (Prisma shadow DB has no auth schema):
-- CREATE POLICY "subscriptions_select_own"
--   ON public.subscriptions
--   FOR SELECT
--   TO authenticated
--   USING (auth.uid() = user_id);

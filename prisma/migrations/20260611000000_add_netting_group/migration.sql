ALTER TABLE "transaction_meta" ADD COLUMN "netting_group" TEXT;

CREATE INDEX "transaction_meta_netting_group_idx" ON "transaction_meta"("netting_group");

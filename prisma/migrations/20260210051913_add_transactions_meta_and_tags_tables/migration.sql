-- CreateTable
CREATE TABLE "transaction_meta" (
    "transaction_id" TEXT NOT NULL,
    "account_transfer_group" TEXT,
    "system_tag_id" INTEGER,

    CONSTRAINT "transaction_meta_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "system_tag" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_meta_account_transfer_group_idx" ON "transaction_meta"("account_transfer_group");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- AddForeignKey
ALTER TABLE "transaction_meta" ADD CONSTRAINT "transaction_meta_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_meta" ADD CONSTRAINT "transaction_meta_system_tag_id_fkey" FOREIGN KEY ("system_tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

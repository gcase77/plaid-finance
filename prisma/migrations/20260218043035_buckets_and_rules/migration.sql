/*
  Warnings:

  - You are about to drop the column `system_tag` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the column `system_tag_id` on the `transaction_meta` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,user_id]` on the table `tags` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `tags` table without a default value. This is not possible if the table is not empty.
  - Made the column `user_id` on table `tags` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('income_bucket_1', 'income_bucket_2', 'spending_bucket_1', 'spending_bucket_2', 'meta');

-- CreateEnum
CREATE TYPE "BudgetRuleType" AS ENUM ('flat_rate', 'percent_of_income');

-- CreateEnum
CREATE TYPE "CalendarWindow" AS ENUM ('week', 'month');

-- CreateEnum
CREATE TYPE "RolloverOption" AS ENUM ('none', 'surplus', 'deficit', 'both');

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_user_id_fkey";

-- DropForeignKey
ALTER TABLE "transaction_meta" DROP CONSTRAINT "transaction_meta_system_tag_id_fkey";

-- DropIndex
DROP INDEX "tags_name_key";

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "system_tag",
ADD COLUMN     "type" "TagType" NOT NULL,
ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "transaction_meta" DROP COLUMN "system_tag_id",
ADD COLUMN     "bucket_1_tag_id" INTEGER,
ADD COLUMN     "bucket_2_tag_id" INTEGER,
ADD COLUMN     "meta_tag_id" INTEGER;

-- CreateTable
CREATE TABLE "budget_rules" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "type" "BudgetRuleType" NOT NULL,
    "flat_amount" DOUBLE PRECISION,
    "percent" DOUBLE PRECISION,
    "calendar_window" "CalendarWindow" NOT NULL,
    "rollover_options" "RolloverOption" NOT NULL,

    CONSTRAINT "budget_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_user_id_key" ON "tags"("name", "user_id");

-- AddForeignKey
ALTER TABLE "transaction_meta" ADD CONSTRAINT "transaction_meta_bucket_1_tag_id_fkey" FOREIGN KEY ("bucket_1_tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_meta" ADD CONSTRAINT "transaction_meta_bucket_2_tag_id_fkey" FOREIGN KEY ("bucket_2_tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_meta" ADD CONSTRAINT "transaction_meta_meta_tag_id_fkey" FOREIGN KEY ("meta_tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "BudgetRuleSourceType" AS ENUM ('tag', 'detected_category');

-- AlterTable
ALTER TABLE "budget_rules"
ADD COLUMN "rule_source_type" "BudgetRuleSourceType" NOT NULL DEFAULT 'tag',
ADD COLUMN "detected_category" TEXT,
ALTER COLUMN "tag_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "budget_rules_user_id_detected_category_idx" ON "budget_rules"("user_id", "detected_category");

-- AddConstraint
ALTER TABLE "budget_rules"
ADD CONSTRAINT "budget_rules_source_xor_check" CHECK (
  (
    "rule_source_type" = 'tag'
    AND "tag_id" IS NOT NULL
    AND "detected_category" IS NULL
  )
  OR
  (
    "rule_source_type" = 'detected_category'
    AND "tag_id" IS NULL
    AND "detected_category" IS NOT NULL
  )
);

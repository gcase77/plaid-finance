-- AlterEnum
ALTER TYPE "BudgetRuleSourceType" ADD VALUE IF NOT EXISTS 'all_spending';

-- Relax source XOR constraint to allow all_spending (no tag, no detected_category).
-- Cast to text so the new enum value can be referenced in the same migration.
ALTER TABLE "budget_rules" DROP CONSTRAINT IF EXISTS "budget_rules_source_xor_check";
ALTER TABLE "budget_rules"
ADD CONSTRAINT "budget_rules_source_xor_check" CHECK (
  (
    "rule_source_type"::text = 'tag'
    AND "tag_id" IS NOT NULL
    AND "detected_category" IS NULL
  )
  OR
  (
    "rule_source_type"::text = 'detected_category'
    AND "tag_id" IS NULL
    AND "detected_category" IS NOT NULL
  )
  OR
  (
    "rule_source_type"::text = 'all_spending'
    AND "tag_id" IS NULL
    AND "detected_category" IS NULL
  )
);

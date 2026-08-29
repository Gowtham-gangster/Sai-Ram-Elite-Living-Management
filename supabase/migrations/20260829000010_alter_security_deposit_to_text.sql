-- Migration: Alter securityDeposit to TEXT on Registration and Resident tables
-- Preserves all raw Google Form short-answer values (e.g. "0", "2000", "1000", "Yes", "Yes Done", etc.)

ALTER TABLE "public"."Registration" 
  ALTER COLUMN "securityDeposit" DROP DEFAULT;

ALTER TABLE "public"."Registration" 
  ALTER COLUMN "securityDeposit" TYPE TEXT USING "securityDeposit"::TEXT;

ALTER TABLE "public"."Resident" 
  ALTER COLUMN "securityDeposit" DROP DEFAULT;

ALTER TABLE "public"."Resident" 
  ALTER COLUMN "securityDeposit" DROP NOT NULL;

ALTER TABLE "public"."Resident" 
  ALTER COLUMN "securityDeposit" TYPE TEXT USING "securityDeposit"::TEXT;

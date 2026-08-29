-- Migration: Add recurring payment reminder support
-- Description: Adds sequence and overdueDays to PaymentReminder, adds lastReminderSentAt and reminderCount to MonthlyPayment, and establishes unique index on (monthlyPaymentId, sequence).

-- 1. Alter PaymentReminder table
ALTER TABLE "PaymentReminder" ADD COLUMN IF NOT EXISTS "sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PaymentReminder" ADD COLUMN IF NOT EXISTS "overdueDays" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint if present
ALTER TABLE "PaymentReminder" DROP CONSTRAINT IF EXISTS "PaymentReminder_monthlyPaymentId_reminderType_key";
DROP INDEX IF EXISTS "PaymentReminder_monthlyPaymentId_reminderType_key";

-- Create new unique constraint / index
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentReminder_monthlyPaymentId_sequence_key" ON "PaymentReminder"("monthlyPaymentId", "sequence");
CREATE INDEX IF NOT EXISTS "PaymentReminder_sequence_idx" ON "PaymentReminder"("sequence");

-- 2. Alter MonthlyPayment table
ALTER TABLE "MonthlyPayment" ADD COLUMN IF NOT EXISTS "lastReminderSentAt" TIMESTAMP(3);
ALTER TABLE "MonthlyPayment" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER NOT NULL DEFAULT 0;

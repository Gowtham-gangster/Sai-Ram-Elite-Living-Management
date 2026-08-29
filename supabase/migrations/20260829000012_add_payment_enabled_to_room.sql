-- Migration: Add paymentEnabled flag to Room table for Room-Level Payment Management Exclusion
-- Default: true (normal rooms manage payments as usual)

ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "paymentEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Room_paymentEnabled_idx" ON "Room"("paymentEnabled");

-- Initial Configuration: Room 102 is complimentary/owner's friends -> paymentEnabled = false
UPDATE "Room" SET "paymentEnabled" = false WHERE "roomNumber" = '102';

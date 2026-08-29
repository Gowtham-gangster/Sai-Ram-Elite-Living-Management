-- Migration: 20260829000014_google_drive_receipt_storage.sql
-- Description: Add Google Drive metadata tracking fields to Receipt table

ALTER TABLE "Receipt" 
ADD COLUMN IF NOT EXISTS "googleDriveFolderId" TEXT,
ADD COLUMN IF NOT EXISTS "receiptFileName" TEXT,
ADD COLUMN IF NOT EXISTS "driveUploadStatus" TEXT DEFAULT 'READY',
ADD COLUMN IF NOT EXISTS "driveUploadedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Receipt_googleDriveFolderId_idx" ON "Receipt"("googleDriveFolderId");

-- Migration: Add googleDriveFileId, status, and downloadToken to Receipt table
-- Description: Stores Google Drive receipt file IDs and secure download tokens for resident download.

ALTER TABLE public."Receipt" 
ADD COLUMN IF NOT EXISTS "googleDriveFileId" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'READY',
ADD COLUMN IF NOT EXISTS "downloadToken" TEXT;

-- Create unique index on downloadToken and index on googleDriveFileId
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_downloadToken_key" 
ON public."Receipt"("downloadToken");

CREATE INDEX IF NOT EXISTS "Receipt_googleDriveFileId_idx" 
ON public."Receipt"("googleDriveFileId");

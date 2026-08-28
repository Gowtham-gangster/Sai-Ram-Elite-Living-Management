-- Migration: Add googleDriveFileId to Registration table
-- Description: Adds googleDriveFileId column to store authoritative Google Drive file IDs without duplicating binaries.

ALTER TABLE public."Registration" 
ADD COLUMN IF NOT EXISTS "googleDriveFileId" TEXT;

-- Add index on googleDriveFileId for fast retrieval
CREATE INDEX IF NOT EXISTS "Registration_googleDriveFileId_idx" 
ON public."Registration"("googleDriveFileId");

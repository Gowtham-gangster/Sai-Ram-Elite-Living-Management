-- Migration: Add identity document fields to Resident model for document propagation from Registration
ALTER TABLE "Resident" ADD COLUMN IF NOT EXISTS "identityDocumentUrl" TEXT;
ALTER TABLE "Resident" ADD COLUMN IF NOT EXISTS "googleDriveFileId" TEXT;

-- Backfill any existing approved residents from their associated Registration records
UPDATE "Resident" r
SET 
  "identityDocumentUrl" = COALESCE(r."identityDocumentUrl", reg."identityDocumentUrl"),
  "googleDriveFileId" = COALESCE(r."googleDriveFileId", reg."googleDriveFileId")
FROM "Registration" reg
WHERE reg."residentId" = r."id"
  AND (reg."identityDocumentUrl" IS NOT NULL OR reg."googleDriveFileId" IS NOT NULL);

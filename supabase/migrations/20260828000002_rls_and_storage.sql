-- ==============================================================================
-- SAIRAM ELITE LIVING — HOSTEL MANAGEMENT SYSTEM
-- Migration 02: Row Level Security (RLS) Hardening & Private Storage Setup
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable Row Level Security (RLS) on all 14 PascalCase Prisma Application Tables
-- ------------------------------------------------------------------------------

ALTER TABLE public."AdminUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Resident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Registration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MonthlyPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReminderTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomChangeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HostelSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SyncLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Security Default: Zero Public/Anonymous Access
-- By enabling RLS without permissive policies for the 'anon' role, PostgREST
-- automatically rejects 100% of unauthenticated/anonymous HTTP client requests.
-- Server-side Prisma connects via the superuser 'postgres' role which bypasses RLS.
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- 3. Private Supabase Storage Buckets Configuration
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('resident-documents', 'resident-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false;

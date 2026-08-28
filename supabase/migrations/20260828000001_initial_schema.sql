-- ==============================================================================
-- SAIRAM ELITE LIVING — HOSTEL MANAGEMENT SYSTEM
-- Migration 01: Core Database Schema (PostgreSQL / Supabase)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. PROFILES (Admin / Staff Profiles linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff', 'manager')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. ROOMS (Strictly Room Numbers & Capacity — ZERO BED CONCEPT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  floor INTEGER NOT NULL DEFAULT 1 CHECK (floor >= 0),
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  sharing_type TEXT NOT NULL DEFAULT '2 Sharing' CHECK (sharing_type IN ('Single', '2 Sharing', '3 Sharing', '4 Sharing', '5 Sharing', 'Other')),
  monthly_rent NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_rent >= 0),
  security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 2000.00 CHECK (security_deposit >= 0),
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance', 'Inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON public.rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON public.rooms(floor);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_sharing_type ON public.rooms(sharing_type);

CREATE TRIGGER trigger_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. RESIDENTS (Google Form Intake & KYC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL CHECK (mobile_number ~ '^[0-9+\s\-]{10,15}$'),
  guardian_name TEXT,
  emergency_contact_number TEXT,
  aadhaar_number TEXT,
  occupation_type TEXT CHECK (occupation_type IN ('STUDENT', 'WORKING_PROFESSIONAL', 'OTHER') OR occupation_type IS NULL),
  occupation TEXT,
  company_or_college_name TEXT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_checkout_date DATE,
  actual_checkout_date DATE,
  security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 2000.00 CHECK (security_deposit >= 0),
  agreed_monthly_rent NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (agreed_monthly_rent >= 0),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Notice Period', 'Checked Out')),
  declaration_accepted BOOLEAN NOT NULL DEFAULT false,
  declaration_accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_residents_room_id ON public.residents(room_id);
CREATE INDEX IF NOT EXISTS idx_residents_status ON public.residents(status);
CREATE INDEX IF NOT EXISTS idx_residents_mobile ON public.residents(mobile_number);
CREATE INDEX IF NOT EXISTS idx_residents_aadhaar ON public.residents(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_residents_check_in_date ON public.residents(check_in_date);

CREATE TRIGGER trigger_residents_updated_at
BEFORE UPDATE ON public.residents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. RESIDENT DOCUMENTS (Private Storage References)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resident_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('Aadhaar Card', 'College ID', 'Company ID', 'Passport', 'Driving License', 'Other')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER CHECK (file_size > 0),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resident_documents_resident_id ON public.resident_documents(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_documents_doc_type ON public.resident_documents(document_type);

-- ------------------------------------------------------------------------------
-- 5. REGISTRATIONS (Google Form Submissions Pending Review)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source TEXT NOT NULL DEFAULT 'GOOGLE_FORM',
  external_response_id TEXT,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  guardian_name TEXT,
  emergency_contact_number TEXT,
  aadhaar_number TEXT,
  occupation_type TEXT,
  occupation TEXT,
  company_or_college_name TEXT,
  requested_room_number TEXT,
  check_in_date DATE,
  security_deposit NUMERIC(10, 2) DEFAULT 2000.00 CHECK (security_deposit >= 0),
  declaration_accepted BOOLEAN NOT NULL DEFAULT false,
  declaration_accepted_at TIMESTAMPTZ,
  source_submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Under Review', 'Approved', 'Rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_external_dedup 
ON public.registrations(external_source, external_response_id) 
WHERE external_response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_mobile ON public.registrations(mobile_number);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON public.registrations(created_at DESC);

CREATE TRIGGER trigger_registrations_updated_at
BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. ROOM CHANGE REQUESTS (Resident / Google Form Room Transfers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  current_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  requested_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'ADMIN_PORTAL' CHECK (source IN ('ADMIN_PORTAL', 'GOOGLE_FORM', 'RESIDENT_REQUEST', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_change_resident ON public.room_change_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_room_change_status ON public.room_change_requests(status);

CREATE TRIGGER trigger_room_change_requests_updated_at
BEFORE UPDATE ON public.room_change_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. PAYMENTS (Monthly Billing Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE RESTRICT,
  billing_month VARCHAR(7) NOT NULL CHECK (billing_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  maintenance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (maintenance_amount >= 0),
  late_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (late_fee >= 0),
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
  total_due NUMERIC(10, 2) GENERATED ALWAYS AS (amount + maintenance_amount + late_fee - discount) STORED,
  due_date DATE NOT NULL,
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Other') OR payment_method IS NULL),
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Paid', 'Overdue', 'Rejected')),
  notes TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_resident_billing_period UNIQUE (resident_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_payments_resident_id ON public.payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_payments_billing_month ON public.payments(billing_month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);

CREATE TRIGGER trigger_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. RECEIPTS (Tax Invoices for Confirmed Payments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL UNIQUE,
  file_storage_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON public.receipts(payment_id);

-- ------------------------------------------------------------------------------
-- 9. REMINDERS (Automated Schedule Queue & Dispatch Logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('UPCOMING_DUE', 'DUE_TODAY', 'OVERDUE_NOTICE', 'NOTICE_PERIOD_EXPIRY', 'CUSTOM')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Pending', 'Sent', 'Failed', 'Cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at ON public.reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_reminders_resident_id ON public.reminders(resident_id);

CREATE TRIGGER trigger_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. NOTIFICATIONS (In-App Administrative Activity Alerts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('NEW_REGISTRATION', 'RESIDENT_UPDATED', 'ROOM_CHANGE_REQUEST', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'REMINDER_FAILED', 'SYSTEM_ALERT', 'GENERAL')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ------------------------------------------------------------------------------
-- 11. HOSTEL SETTINGS (Private Operational & Banking Information)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hostel_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  hostel_name TEXT NOT NULL DEFAULT 'SAIRAM ELITE LIVING',
  address TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  email TEXT,
  website TEXT,
  bank_name TEXT,
  account_holder_name TEXT,
  account_number TEXT,
  ifsc TEXT,
  upi_id TEXT,
  payment_instructions TEXT,
  default_due_day_of_month INTEGER NOT NULL DEFAULT 5 CHECK (default_due_day_of_month BETWEEN 1 AND 28),
  grace_period_days INTEGER NOT NULL DEFAULT 3 CHECK (grace_period_days >= 0),
  late_fee_per_day NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (late_fee_per_day >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_hostel_settings_updated_at
BEFORE UPDATE ON public.hostel_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 12. AUDIT LOGS (Immutable Administrative Action Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

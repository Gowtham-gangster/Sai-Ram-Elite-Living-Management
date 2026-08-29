-- ====================================================================
-- Migration 09: Add PaymentSession Table for Architectural Preparedness
-- ====================================================================

CREATE TABLE IF NOT EXISTS "PaymentSession" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "monthlyPaymentId" TEXT NOT NULL,
  "residentId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "billingMonth" VARCHAR(20) NOT NULL,
  "roomNumber" VARCHAR(20) NOT NULL,
  "transactionReference" VARCHAR(100) NOT NULL UNIQUE,
  "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "paymentMethod" VARCHAR(30) NOT NULL DEFAULT 'UPI',
  "provider" VARCHAR(50) NOT NULL DEFAULT 'PERSONAL_UPI_FALLBACK',
  "providerTransactionId" VARCHAR(100),
  "verificationStatus" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMPTZ,
  "qrPayload" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdBy" VARCHAR(30) NOT NULL DEFAULT 'RESIDENT',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "fk_payment_session_monthly_payment"
    FOREIGN KEY ("monthlyPaymentId")
    REFERENCES "MonthlyPayment"("id")
    ON DELETE CASCADE,

  CONSTRAINT "fk_payment_session_resident"
    FOREIGN KEY ("residentId")
    REFERENCES "Resident"("id")
    ON DELETE CASCADE
);

-- Indexes for high-performance session lookups, reference validation, and expiration management
CREATE INDEX IF NOT EXISTS "idx_payment_session_tx_ref" ON "PaymentSession"("transactionReference");
CREATE INDEX IF NOT EXISTS "idx_payment_session_monthly_payment_id" ON "PaymentSession"("monthlyPaymentId");
CREATE INDEX IF NOT EXISTS "idx_payment_session_resident_id" ON "PaymentSession"("residentId");
CREATE INDEX IF NOT EXISTS "idx_payment_session_status" ON "PaymentSession"("status");
CREATE INDEX IF NOT EXISTS "idx_payment_session_expires_at" ON "PaymentSession"("expiresAt");

-- Enable Row Level Security (RLS)
ALTER TABLE "PaymentSession" ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on PaymentSession" ON "PaymentSession";
CREATE POLICY "Service role full access on PaymentSession"
  ON "PaymentSession"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view payment sessions
DROP POLICY IF EXISTS "Authenticated users view PaymentSession" ON "PaymentSession";
CREATE POLICY "Authenticated users view PaymentSession"
  ON "PaymentSession"
  FOR SELECT
  TO authenticated
  USING (true);

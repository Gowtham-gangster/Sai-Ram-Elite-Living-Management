-- ==============================================================================
-- SAIRAM ELITE LIVING — HOSTEL MANAGEMENT SYSTEM
-- Migration 06: Remove Security Deposit from Room Management
-- ==============================================================================

-- 1. Drop existing view dependent on Room table
DROP VIEW IF EXISTS public.room_occupancy_view;

-- 2. Remove securityDeposit column from Room table
ALTER TABLE public."Room" DROP COLUMN IF EXISTS "securityDeposit";

-- 3. Recreate room_occupancy_view calculating monthly_collection dynamically without room security_deposit
CREATE OR REPLACE VIEW public.room_occupancy_view AS
SELECT
  rm.id AS room_id,
  rm."roomNumber",
  rm.floor,
  rm."sharingType",
  rm.capacity,
  rm.status AS configured_status,
  COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD')) AS current_occupancy,
  GREATEST(0, rm.capacity - COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD'))) AS available_slots,
  COALESCE(SUM(res."monthlyRent") FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD')), 0) AS monthly_collection,
  CASE
    WHEN rm.status = 'MAINTENANCE' THEN 'MAINTENANCE'
    WHEN COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD')) >= rm.capacity THEN 'FULL'
    ELSE 'AVAILABLE'
  END AS dynamic_status,
  CASE
    WHEN rm.capacity > 0 THEN 
      ROUND((COUNT(res.id) FILTER (WHERE res.status IN ('ACTIVE', 'NOTICE_PERIOD'))::NUMERIC / rm.capacity::NUMERIC) * 100, 1)
    ELSE 0
  END AS occupancy_percentage,
  rm."createdAt",
  rm."updatedAt"
FROM public."Room" rm
LEFT JOIN public."Resident" res ON res."roomId" = rm.id
GROUP BY rm.id, rm."roomNumber", rm.floor, rm."sharingType", rm.capacity, rm.status, rm."createdAt", rm."updatedAt";

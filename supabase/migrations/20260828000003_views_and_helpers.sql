-- ==============================================================================
-- SAIRAM ELITE LIVING — HOSTEL MANAGEMENT SYSTEM
-- Migration 03: Occupancy Calculation Views & Business Rule Helpers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Dynamic Room Occupancy View (Zero-Bed, Room-Based Capacity)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.room_occupancy_view AS
SELECT
  rm.id AS room_id,
  rm.room_number,
  rm.floor,
  rm.sharing_type,
  rm.capacity,
  rm.monthly_rent,
  rm.security_deposit,
  rm.status AS configured_status,
  COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period')) AS current_occupancy,
  GREATEST(0, rm.capacity - COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period'))) AS available_slots,
  CASE
    WHEN rm.status = 'Maintenance' THEN 'Maintenance'
    WHEN rm.status = 'Inactive' THEN 'Inactive'
    WHEN COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period')) >= rm.capacity THEN 'Occupied'
    ELSE 'Available'
  END AS dynamic_status,
  CASE
    WHEN rm.capacity > 0 THEN 
      ROUND((COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period'))::NUMERIC / rm.capacity::NUMERIC) * 100, 1)
    ELSE 0
  END AS occupancy_percentage,
  rm.created_at,
  rm.updated_at
FROM public.rooms rm
LEFT JOIN public.residents res ON res.room_id = rm.id
GROUP BY rm.id, rm.room_number, rm.floor, rm.sharing_type, rm.capacity, rm.monthly_rent, rm.security_deposit, rm.status, rm.created_at, rm.updated_at;

-- ------------------------------------------------------------------------------
-- Function: Check Room Capacity (Enforces Capacity Limits)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_room_capacity(target_room_id UUID)
RETURNS TABLE(
  is_available BOOLEAN,
  current_count BIGINT,
  total_capacity INT,
  available_capacity BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (rm.status = 'Available' AND COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period')) < rm.capacity) AS is_available,
    COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period')) AS current_count,
    rm.capacity AS total_capacity,
    GREATEST(0, rm.capacity - COUNT(res.id) FILTER (WHERE res.status IN ('Active', 'Notice Period'))) AS available_capacity
  FROM public.rooms rm
  LEFT JOIN public.residents res ON res.room_id = rm.id
  WHERE rm.id = target_room_id
  GROUP BY rm.id, rm.status, rm.capacity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

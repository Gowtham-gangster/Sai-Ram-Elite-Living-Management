/**
 * Centralized Server-Side Payment Eligibility Service
 * 
 * Rules:
 * - Room-level `paymentEnabled` determines if a room and its current residents participate
 *   in rent collection, monthly bill generation, payment sessions, QR codes, UPI intents,
 *   reminders, and financial income calculations.
 * - Rooms with `paymentEnabled === false` remain 100% active for census, occupancy, room transfers,
 *   and resident profiles, but are excluded from all payment management operations.
 * - ZERO hard-coded room numbers are used. Configuration is 100% database-driven.
 */

export interface IPaymentEligibleRoom {
  paymentEnabled?: boolean | null;
  roomNumber?: string | null;
}

export interface IPaymentEligibleResident {
  fullName?: string | null;
  room?: IPaymentEligibleRoom | null;
}

/**
 * Check if a room is managed under the hostel payment & rent collection system.
 */
export function isPaymentManagedRoom(room?: IPaymentEligibleRoom | null): boolean {
  if (!room) return true; // fallback default
  return room.paymentEnabled !== false;
}

/**
 * Assert that a room is payment-managed, throwing a standard descriptive error if excluded.
 */
export function assertPaymentEnabledForRoom(room?: IPaymentEligibleRoom | null): void {
  if (!isPaymentManagedRoom(room)) {
    const roomLabel = room?.roomNumber ? `Room ${room.roomNumber}` : 'This room';
    throw new Error(`Online rent collection is not applicable for ${roomLabel}.`);
  }
}

/**
 * Assert that a resident's current room is payment-managed, throwing an error if excluded.
 */
export function assertPaymentEnabledForResident(resident?: IPaymentEligibleResident | null): void {
  if (resident?.room && !isPaymentManagedRoom(resident.room)) {
    const name = resident.fullName || 'Resident';
    const roomLabel = resident.room.roomNumber ? `Room ${resident.room.roomNumber}` : 'their room';
    throw new Error(`Rent payment management is not applicable for ${name} (${roomLabel}).`);
  }
}

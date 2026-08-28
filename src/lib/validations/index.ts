import { z } from 'zod';

// Indian Phone Number validation helper
const indianPhoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;

// Authentication Schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Room Schema - STRICTLY ROOM NUMBERS & CAPACITIES - ZERO BED FIELDS
export const RoomSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required').trim(),
  floor: z.coerce.number().int().min(0, 'Floor must be 0 or higher'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1 resident'),
  sharingType: z.enum(['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARE', 'DORMITORY', 'OTHER']),
  amenities: z.array(z.string()).default([]),
  status: z.enum(['AVAILABLE', 'FULL', 'MAINTENANCE']).default('AVAILABLE'),
  notes: z.string().optional().nullable(),
});

// Resident Schema - Assigned directly to roomId
export const ResidentSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  phone: z
    .string()
    .trim()
    .regex(indianPhoneRegex, 'Please enter a valid 10-digit Indian phone number (e.g. 9876543210 or +91 9876543210)'),
  alternatePhone: z
    .string()
    .trim()
    .regex(indianPhoneRegex, 'Please enter a valid 10-digit Indian alternate phone number')
    .optional()
    .or(z.literal(''))
    .nullable(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')).nullable(),
  roomId: z.string().min(1, 'Room assignment is required'),
  monthlyRent: z.coerce.number().min(0, 'Monthly rent cannot be negative').default(0),
  securityDeposit: z.coerce.number().min(0, 'Security deposit cannot be negative').default(2000),
  checkInDate: z.string().or(z.date()),
  expectedCheckoutDate: z.string().or(z.date()).optional().or(z.literal('')).nullable(),
  checkOutDate: z.string().or(z.date()).optional().or(z.literal('')).nullable(),
  idProofType: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER']).optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z
    .string()
    .trim()
    .regex(indianPhoneRegex, 'Please enter a valid 10-digit emergency contact phone number')
    .optional()
    .or(z.literal(''))
    .nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'NOTICE_PERIOD', 'VACATED']).default('ACTIVE'),
  notes: z.string().optional().nullable(),
});

// Change Room Schema
export const ChangeRoomSchema = z.object({
  newRoomId: z.string().min(1, 'Target room is required'),
  transferDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

// Start Notice Period / Checkout Schema
export const NoticePeriodSchema = z.object({
  expectedCheckoutDate: z.string().min(1, 'Expected checkout date is required'),
  notes: z.string().optional().nullable(),
});

// Complete Checkout Schema
export const CheckOutResidentSchema = z.object({
  checkOutDate: z.string().min(1, 'Actual checkout date is required'),
  refundDepositAmount: z.coerce.number().min(0).optional(),
  deductionsAmount: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

// Payment Recording Schema
export const RecordPaymentSchema = z.object({
  monthlyPaymentId: z.string().min(1, 'Monthly payment ID is required'),
  amountPaid: z.coerce.number().positive('Amount paid must be greater than 0'),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  transactionReference: z.string().optional().nullable(),
  proofAttachmentUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Payment Status Update Schema
export const UpdatePaymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'SUBMITTED', 'PAID', 'OVERDUE', 'REJECTED']),
  notes: z.string().optional().nullable(),
});

// Generate Dues Schema
export const GenerateDuesSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Billing month must be in YYYY-MM format (e.g. 2026-08)'),
});

// Settings Schema (Rent Due Rules & Penalties removed)
export const HostelSettingsSchema = z.object({
  hostelName: z.string().min(2, 'Hostel name is required').trim(),
  hostelAddress: z.string().min(5, 'Hostel address is required').trim(),
  contactPhone: z.string().min(5, 'Contact phone is required').trim(),
  whatsAppNumber: z.string().min(5, 'WhatsApp number is required').trim(),
  contactEmail: z.string().email('Invalid contact email').trim(),
  websiteUrl: z.string().url('Invalid website URL format (e.g. https://sairameliteliving.com)').or(z.literal('')).optional().nullable(),
  bankName: z.string().min(2, 'Bank name is required').trim(),
  accountHolderName: z.string().min(2, 'Account holder name is required').trim(),
  accountNumber: z.string().min(5, 'Account number is required').trim(),
  ifscCode: z.string().min(4, 'IFSC code is required').trim().toUpperCase(),
  upiId: z.string().min(3, 'UPI ID is required').trim(),
  paymentInstructions: z.string().optional().nullable(),
  rulesAndRegulations: z.string().optional().nullable(),
});

// Admin Password Update Schema
export const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New password and confirmation do not match',
  path: ['confirmPassword'],
});


/**
 * SAIRAM ELITE LIVING — Database Schema Types
 * PostgreSQL / Supabase Tables & Views
 */

export type UserRole = 'owner' | 'admin' | 'staff' | 'manager';
export type RoomSharingType = 'Single' | '2 Sharing' | '3 Sharing' | '4 Sharing' | '5 Sharing' | 'Other';
export type RoomStatus = 'Available' | 'Occupied' | 'Maintenance' | 'Inactive';
export type ResidentStatus = 'Active' | 'Notice Period' | 'Checked Out';
export type OccupationType = 'STUDENT' | 'WORKING_PROFESSIONAL' | 'OTHER';
export type DocumentType = 'Aadhaar Card' | 'College ID' | 'Company ID' | 'Passport' | 'Driving License' | 'Other';
export type RegistrationStatus = 'New' | 'Under Review' | 'Approved' | 'Rejected';
export type RoomChangeRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Submitted' | 'Paid' | 'Overdue' | 'Rejected';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';
export type ReminderType = 'UPCOMING_DUE' | 'DUE_TODAY' | 'OVERDUE_NOTICE' | 'NOTICE_PERIOD_EXPIRY' | 'CUSTOM';
export type ReminderStatus = 'Scheduled' | 'Pending' | 'Sent' | 'Failed' | 'Cancelled';
export type NotificationType =
  | 'NEW_REGISTRATION'
  | 'RESIDENT_UPDATED'
  | 'ROOM_CHANGE_REQUEST'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'REMINDER_FAILED'
  | 'SYSTEM_ALERT'
  | 'GENERAL';

export interface Profile {
  id: string; // UUID references auth.users(id)
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string; // UUID
  room_number: string;
  floor: number;
  capacity: number;
  sharing_type: RoomSharingType;
  monthly_rent: number;
  security_deposit: number;
  status: RoomStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resident {
  id: string; // UUID
  full_name: string;
  mobile_number: string;
  guardian_name?: string | null;
  emergency_contact_number?: string | null;
  aadhaar_number?: string | null;
  occupation_type?: OccupationType | null;
  occupation?: string | null;
  company_or_college_name?: string | null;
  room_id: string; // UUID references rooms(id)
  check_in_date: string;
  expected_checkout_date?: string | null;
  actual_checkout_date?: string | null;
  security_deposit: number;
  agreed_monthly_rent: number;
  status: ResidentStatus;
  declaration_accepted: boolean;
  declaration_accepted_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResidentDocument {
  id: string; // UUID
  resident_id: string; // UUID references residents(id)
  document_type: DocumentType;
  file_name: string;
  storage_path: string;
  mime_type?: string | null;
  file_size?: number | null;
  uploaded_at: string;
  uploaded_by?: string | null; // UUID references profiles(id)
  created_at: string;
}

export interface Registration {
  id: string; // UUID
  external_source: string;
  external_response_id?: string | null;
  full_name: string;
  mobile_number: string;
  guardian_name?: string | null;
  emergency_contact_number?: string | null;
  aadhaar_number?: string | null;
  occupation_type?: string | null;
  occupation?: string | null;
  company_or_college_name?: string | null;
  requested_room_number?: string | null;
  check_in_date?: string | null;
  security_deposit?: number | null;
  declaration_accepted: boolean;
  declaration_accepted_at?: string | null;
  source_submitted_at?: string | null;
  status: RegistrationStatus;
  reviewed_by?: string | null; // UUID references profiles(id)
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomChangeRequest {
  id: string; // UUID
  resident_id: string; // UUID references residents(id)
  current_room_id: string; // UUID references rooms(id)
  requested_room_id: string; // UUID references rooms(id)
  reason?: string | null;
  source: string;
  status: RoomChangeRequestStatus;
  reviewed_by?: string | null; // UUID references profiles(id)
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string; // UUID
  resident_id: string; // UUID references residents(id)
  billing_month: string; // YYYY-MM
  amount: number;
  maintenance_amount: number;
  late_fee: number;
  discount: number;
  total_due: number; // Generated
  due_date: string;
  payment_date?: string | null;
  payment_method?: PaymentMethod | null;
  transaction_reference?: string | null;
  status: PaymentStatus;
  notes?: string | null;
  verified_by?: string | null; // UUID references profiles(id)
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string; // UUID
  payment_id: string; // UUID references payments(id)
  receipt_number: string;
  file_storage_path?: string | null;
  generated_at: string;
  generated_by?: string | null; // UUID references profiles(id)
  created_at: string;
}

export interface Reminder {
  id: string; // UUID
  resident_id: string; // UUID references residents(id)
  payment_id?: string | null; // UUID references payments(id)
  reminder_type: ReminderType;
  scheduled_at: string;
  sent_at?: string | null;
  status: ReminderStatus;
  attempt_count: number;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string; // UUID
  user_id?: string | null; // UUID references profiles(id)
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface HostelSettings {
  id: string;
  hostel_name: string;
  address?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  website?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  upi_id?: string | null;
  payment_instructions?: string | null;
  default_due_day_of_month: number;
  grace_period_days: number;
  late_fee_per_day: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string; // UUID
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface RoomOccupancyView {
  room_id: string;
  room_number: string;
  floor: number;
  sharing_type: RoomSharingType;
  capacity: number;
  monthly_rent: number;
  security_deposit: number;
  configured_status: RoomStatus;
  current_occupancy: number;
  available_slots: number;
  dynamic_status: string;
  occupancy_percentage: number;
  created_at: string;
  updated_at: string;
}

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  DoorOpen,
  Phone,
  Calendar,
  CreditCard,
  Edit2,
  UserX,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRightLeft,
  Clock,
  IndianRupee,
  FileText,
  Shield,
  Building,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  UploadCloud,
  FileCheck,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge, StatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { maskAadhaar } from '@/lib/residentStats';
import { formatSharingType } from '@/lib/formatters';

export default function ResidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [resident, setResident] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Aadhaar reveal state
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    idProofType: 'Aadhaar Card',
    idProofNumber: '',
    occupation: 'Student',
    companyOrCollegeName: '',
    roomId: '',
    checkInDate: '',
    expectedCheckoutDate: '',
    monthlyRent: 8000,
    securityDeposit: 2000,
    status: 'ACTIVE',
    notes: '',
  });

  // Room Change Modal
  const [isRoomChangeOpen, setIsRoomChangeOpen] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [roomChangeReason, setRoomChangeReason] = useState('');

  // Notice Period Modal
  const [isNoticePeriodOpen, setIsNoticePeriodOpen] = useState(false);
  const [noticeCheckoutDate, setNoticeCheckoutDate] = useState('');
  const [noticeNotes, setNoticeNotes] = useState('');

  // Checkout Modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    checkOutDate: new Date().toISOString().split('T')[0],
    reason: 'Normal Checkout',
    refundDepositAmount: 2000,
    deductionsAmount: 0,
    notes: '',
  });

  // Feedback State
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchResidentDetails();
    }
  }, [id]);

  const fetchResidentDetails = async () => {
    try {
      setIsLoading(true);
      const [resData, resRooms] = await Promise.all([
        fetch(`/api/residents/${id}`),
        fetch('/api/rooms'),
      ]);

      const data = await resData.json();
      const dataRooms = await resRooms.json();

      if (data.resident) {
        setResident(data.resident);
        setFormData({
          fullName: data.resident.fullName || '',
          phone: data.resident.phone || '',
          emergencyContactName: data.resident.emergencyContactName || '',
          emergencyContactPhone: data.resident.emergencyContactPhone || '',
          idProofType: data.resident.idProofType || 'Aadhaar Card',
          idProofNumber: data.resident.idProofNumber || '',
          occupation: data.resident.occupation || 'Student',
          companyOrCollegeName: data.resident.companyOrCollegeName || data.resident.address || '',
          roomId: data.resident.roomId || '',
          checkInDate: data.resident.checkInDate ? data.resident.checkInDate.split('T')[0] : '',
          expectedCheckoutDate: data.resident.expectedCheckoutDate ? data.resident.expectedCheckoutDate.split('T')[0] : '',
          monthlyRent: data.resident.monthlyRent || 8000,
          securityDeposit: data.resident.securityDeposit || 2000,
          status: data.resident.status || 'ACTIVE',
          notes: data.resident.notes || '',
        });
      }

      if (data.auditLogs) {
        setAuditLogs(data.auditLogs);
      }

      if (dataRooms.rooms) {
        setRooms(dataRooms.rooms);
      }
    } catch (err) {
      console.error('Failed to fetch resident profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/residents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          address: formData.companyOrCollegeName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update resident details.');
      }

      setActionSuccess('Resident profile updated successfully!');
      setIsEditModalOpen(false);
      fetchResidentDetails();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteRoomChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoomId) {
      setActionError('Please select a target room.');
      return;
    }

    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    if (targetRoom) {
      const activeCount = targetRoom.occupancyCount ?? (targetRoom.residents?.length || 0);
      if (activeCount >= targetRoom.capacity) {
        setActionError(`Room ${targetRoom.roomNumber} is full. Cannot transfer resident.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/residents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_ROOM',
          newRoomId: targetRoomId,
          notes: roomChangeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transfer room.');
      }

      setActionSuccess(data.message || 'Room change completed successfully.');
      setIsRoomChangeOpen(false);
      fetchResidentDetails();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteNoticePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeCheckoutDate) {
      setActionError('Expected checkout date is required.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/residents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_NOTICE_PERIOD',
          expectedCheckoutDate: noticeCheckoutDate,
          notes: noticeNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to set notice period.');
      }

      setActionSuccess(data.message);
      setIsNoticePeriodOpen(false);
      fetchResidentDetails();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/residents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECKOUT',
          ...checkoutData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete checkout.');
      }

      setActionSuccess(`${resident.fullName} checked out successfully.`);
      setIsCheckoutModalOpen(false);
      fetchResidentDetails();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        <span>Loading resident profile...</span>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Resident Not Found</h2>
        <button
          type="button"
          onClick={() => router.push('/residents')}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-2xl text-xs font-semibold"
        >
          Back to Residents Directory
        </button>
      </div>
    );
  }

  const isCheckedOut = resident.status === 'VACATED' || resident.status === 'CHECKED OUT';
  const latestPayment = resident.monthlyPayments?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/residents')}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all"
            aria-label="Back to Residents"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {resident.fullName}
              </h1>
              <StatusBadge status={resident.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Room {resident.room?.roomNumber || 'N/A'} • Since{' '}
              {new Date(resident.checkInDate).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>

          {!isCheckedOut && (
            <>
              <button
                type="button"
                onClick={() => setIsRoomChangeOpen(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer Room</span>
              </button>

              {resident.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => setIsNoticePeriodOpen(true)}
                  className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Start Notice Period</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(true)}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Check Out</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold">{actionError}</span>
        </div>
      )}

      {/* 2-Column Responsive Information Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Core Profile Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Personal Information */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Personal Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Full Name</span>
                <span className="font-bold text-white text-sm">{resident.fullName}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Mobile Number</span>
                <span className="font-bold text-slate-200">{resident.phone}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Father&apos;s / Guardian&apos;s Name</span>
                <span className="font-semibold text-slate-200">{resident.emergencyContactName || '—'}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Emergency Contact Phone</span>
                <span className="font-semibold text-slate-200">{resident.emergencyContactPhone || '—'}</span>
              </div>

              {/* Aadhaar with Secure Masking */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 sm:col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Aadhaar Number (Protected)
                  </span>
                  <span className="font-mono font-bold text-slate-200 text-xs">
                    {showFullAadhaar ? resident.idProofNumber || 'Not Recorded' : maskAadhaar(resident.idProofNumber)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullAadhaar(!showFullAadhaar)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5"
                >
                  {showFullAadhaar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showFullAadhaar ? 'Hide' : 'Reveal'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Education / Work */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              <span>Education & Work Particulars</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Occupation Type</span>
                <span className="font-bold text-slate-200">{resident.occupation || 'Student'}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Company or College</span>
                <span className="font-bold text-slate-200">{resident.companyOrCollegeName || resident.address || '—'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Payment Summary */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>Payment Summary</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Current Month</span>
                <span className="text-xs font-bold text-white">
                  {latestPayment?.billingMonth || '2026-08'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Monthly Rent</span>
                <span className="text-xs font-bold text-amber-400">
                  ₹{Number(resident.monthlyRent).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Payment Status</span>
                <span className="mt-0.5 inline-block">
                  {latestPayment ? (
                    <PaymentStatusBadge status={latestPayment.status} />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">Not generated</span>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Last Paid Date</span>
                <span className="text-xs font-semibold text-slate-300">
                  {latestPayment?.paidDate
                    ? new Date(latestPayment.paidDate).toLocaleDateString('en-IN')
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hostel Assignment & Documents */}
        <div className="space-y-6">
          {/* Hostel Room Details */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-amber-400" />
              <span>Room Assignment</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Assigned Room</span>
                  <span className="text-lg font-black text-amber-400">
                    Room {resident.room?.roomNumber || 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Sharing</span>
                  <span className="font-semibold text-slate-200">
                    {formatSharingType(resident.room?.sharingType)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Check-in Date</span>
                  <span className="font-semibold text-slate-200">
                    {new Date(resident.checkInDate).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Security Deposit</span>
                  <span className="font-semibold text-amber-400">
                    ₹{Number(resident.securityDeposit || 2000).toLocaleString('en-IN')}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">(One-time)</span>
                  </span>
                </div>
              </div>

              {resident.expectedCheckoutDate && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Expected Checkout</span>
                  <span className="font-semibold text-amber-400">
                    {new Date(resident.expectedCheckoutDate).toLocaleDateString('en-IN')}
                  </span>
                </div>
              )}

              {resident.notes && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Notes</span>
                  <span className="text-slate-300 whitespace-pre-line">{resident.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Secure Document Storage Status */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-400" />
              <span>Identity Documents</span>
            </h3>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-center">
              <Shield className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="font-bold text-slate-200">Private Document Vault</p>
              <p className="text-[11px] text-slate-500">
                Aadhaar card & college/work proof stored in authenticated Supabase private storage (`resident-documents`).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Resident Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSaving && setIsEditModalOpen(false)}
        title={`Edit ${resident.fullName}'s Profile`}
        subtitle="Update resident information, contact details, or tariff."
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Full Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Mobile Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Guardian&apos;s Name
              </label>
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Occupation
              </label>
              <input
                type="text"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Company or College
              </label>
              <input
                type="text"
                value={formData.companyOrCollegeName}
                onChange={(e) => setFormData({ ...formData, companyOrCollegeName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Monthly Rent (₹)
              </label>
              <input
                type="number"
                value={formData.monthlyRent}
                onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Security Deposit (₹) <span className="text-[10px] text-slate-400 font-normal">(One-time)</span>
              </label>
              <input
                type="number"
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Room Change Modal */}
      <Modal
        isOpen={isRoomChangeOpen}
        onClose={() => !isSaving && setIsRoomChangeOpen(false)}
        title={`Transfer ${resident.fullName} to New Room`}
        subtitle={`Current Room: Room ${resident.room?.roomNumber || 'N/A'}`}
      >
        <form onSubmit={handleExecuteRoomChange} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Select Target Room <span className="text-amber-400">*</span>
            </label>
            <select
              required
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
            >
              <option value="">-- Choose New Room --</option>
              {rooms
                .filter((r) => r.id !== resident.roomId)
                .map((rm) => {
                  const occupants = rm.occupancyCount ?? (rm.residents?.length || 0);
                  const available = Math.max(0, rm.capacity - occupants);
                  const isFull = available === 0;

                  return (
                    <option
                      key={rm.id}
                      value={rm.id}
                      disabled={isFull || rm.status === 'MAINTENANCE'}
                    >
                      Room {rm.roomNumber} - {formatSharingType(rm.sharingType)} ({occupants}/
                      {rm.capacity} Occupied {isFull ? '• FULL' : `• ${available} Space Available`})
                    </option>
                  );
                })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Reason / Remarks for Room Change
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Resident requested AC upgrade or floor change..."
              value={roomChangeReason}
              onChange={(e) => setRoomChangeReason(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsRoomChangeOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
              <span>Confirm Room Transfer</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Notice Period Modal */}
      <Modal
        isOpen={isNoticePeriodOpen}
        onClose={() => !isSaving && setIsNoticePeriodOpen(false)}
        title={`Set Notice Period for ${resident.fullName}`}
        subtitle="Resident will remain an active occupant until checkout date."
      >
        <form onSubmit={handleExecuteNoticePeriod} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Expected Checkout Date <span className="text-amber-400">*</span>
            </label>
            <input
              type="date"
              required
              value={noticeCheckoutDate}
              onChange={(e) => setNoticeCheckoutDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Notice Period Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Job transfer, completed college exams..."
              value={noticeNotes}
              onChange={(e) => setNoticeNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsNoticePeriodOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
              <span>Activate Notice Period</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Checkout Modal */}
      <Modal
        isOpen={isCheckoutModalOpen}
        onClose={() => !isSaving && setIsCheckoutModalOpen(false)}
        title={`Check Out ${resident.fullName}`}
        subtitle={`Vacate Room ${resident.room?.roomNumber || 'N/A'}. Historical records will be preserved.`}
      >
        <form onSubmit={handleExecuteCheckout} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Checkout Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={checkoutData.checkOutDate}
                onChange={(e) => setCheckoutData({ ...checkoutData, checkOutDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Checkout Reason
              </label>
              <input
                type="text"
                value={checkoutData.reason}
                onChange={(e) => setCheckoutData({ ...checkoutData, reason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Deposit Refund (₹)
              </label>
              <input
                type="number"
                min={0}
                value={checkoutData.refundDepositAmount}
                onChange={(e) => setCheckoutData({ ...checkoutData, refundDepositAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Deductions / Damage Charges (₹)
              </label>
              <input
                type="number"
                min={0}
                value={checkoutData.deductionsAmount}
                onChange={(e) => setCheckoutData({ ...checkoutData, deductionsAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Clearance Notes
            </label>
            <textarea
              rows={2}
              placeholder="Key returned, room inspection completed..."
              value={checkoutData.notes}
              onChange={(e) => setCheckoutData({ ...checkoutData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsCheckoutModalOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : null}
              <span>Confirm Resident Checkout</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

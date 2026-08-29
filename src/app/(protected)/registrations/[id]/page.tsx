'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileCheck,
  ArrowLeft,
  Users,
  Building,
  DoorOpen,
  Calendar,
  CreditCard,
  Shield,
  Eye,
  EyeOff,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ExternalLink,
  Info,
  Download,
  FileText,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { maskAadhaar } from '@/lib/residentStats';
import { formatSharingType } from '@/lib/formatters';
import { formatDate } from '@/lib/dateUtils';

export default function RegistrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [registration, setRegistration] = useState<any>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Aadhaar masking
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);

  // Approval / Rejection Modals
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchRegistrationDetails();
    }
  }, [id]);

  const fetchRegistrationDetails = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/registrations/${id}`);
      const data = await res.json();

      if (data.registration) {
        setRegistration(data.registration);
        setRoomInfo(data.roomInfo);
      }
    } catch (err) {
      console.error('Failed to fetch registration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/registrations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber: registration.requestedRoomNumber,
          securityDeposit: registration.securityDeposit ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve registration.');

      setActionSuccess(`${registration.fullName} approved and onboarded as active resident!`);
      setIsApproveOpen(false);
      fetchRegistrationDetails();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setActionError('Please specify a rejection reason.');
      return;
    }

    setIsActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/registrations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject registration.');

      setActionSuccess(`Registration for ${registration.fullName} rejected.`);
      setIsRejectOpen(false);
      setRejectionReason('');
      fetchRegistrationDetails();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMarkReview = async () => {
    try {
      const res = await fetch(`/api/registrations/${id}/review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update review status.');

      setActionSuccess('Registration marked as Under Review.');
      fetchRegistrationDetails();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/registrations');
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        <span>Loading registration details...</span>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Registration Not Found</h2>
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-2xl text-xs font-semibold"
        >
          Back to Registrations
        </button>
      </div>
    );
  }

  const isPending = registration.status === 'NEW' || registration.status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="Back to Registrations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {registration.fullName}
              </h1>
              <StatusBadge status={registration.status} />
              {new Date(registration.updatedAt).getTime() - new Date(registration.createdAt).getTime() > 2000 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Updated via Google Forms
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Source: <span className="font-semibold text-slate-300">Google Form Submission</span> • Submitted{' '}
              {formatDate(registration.sourceSubmittedAt || registration.createdAt)}
              {new Date(registration.updatedAt).getTime() - new Date(registration.createdAt).getTime() > 2000 && (
                <> • Last Synchronized: <span className="text-slate-300 font-medium">{formatDate(registration.updatedAt)}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        {isPending && (
          <div className="flex items-center gap-2 flex-wrap">
            {registration.status === 'NEW' && (
              <button
                type="button"
                onClick={handleMarkReview}
                className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mark Under Review</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsApproveOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Registration</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRejectOpen(true)}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold">{actionError}</span>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Application Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Personal Information */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Personal Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Applicant Full Name</span>
                <span className="font-bold text-white text-sm">{registration.fullName}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Mobile Phone Number</span>
                <span className="font-bold text-slate-200">{registration.mobileNumber}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Father&apos;s / Guardian&apos;s Name</span>
                <span className="font-semibold text-slate-200">{registration.guardianName || '—'}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Emergency Contact Phone</span>
                <span className="font-semibold text-slate-200">{registration.emergencyContactNumber || '—'}</span>
              </div>

              {/* Aadhaar Number with Privacy Masking */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 sm:col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Aadhaar Number (Protected)
                  </span>
                  <span className="font-mono font-bold text-slate-200 text-xs">
                    {showFullAadhaar ? registration.aadhaarNumber || 'Not Recorded' : maskAadhaar(registration.aadhaarNumber)}
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

          {/* Section 2: Occupation */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              <span>Occupation & Work</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Occupation Type</span>
                <span className="font-bold text-slate-200">{registration.occupation || 'Student'}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Company or College</span>
                <span className="font-bold text-slate-200">{registration.companyOrCollegeName || '—'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Declaration & Verification Status */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Declaration & Review Status</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Hostel Rules Declaration</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Accepted & Verified</span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">External Response ID</span>
                <span className="font-mono text-slate-300 text-[11px] block truncate">
                  {registration.externalResponseId || 'N/A'}
                </span>
              </div>
            </div>

            {registration.rejectionReason && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <span className="font-bold block uppercase text-[10px] text-rose-400">Rejection Reason:</span>
                <p className="mt-1 font-medium">{registration.rejectionReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Room Assignment & Capacity Check */}
        <div className="space-y-6">
          {/* Room Capacity Validation Card */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-amber-400" />
              <span>Requested Room Check</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Requested Room</span>
                  <span className="text-xl font-black text-amber-400">
                    Room {registration.requestedRoomNumber || 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Live Status</span>
                  {roomInfo ? (
                    <span
                      className={`font-bold ${
                        roomInfo.isFull ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {roomInfo.isFull ? 'FULL' : `${roomInfo.availableSlots} Space Available`}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not assigned</span>
                  )}
                </div>
              </div>

              {roomInfo && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sharing Type:</span>
                    <span className="font-semibold text-slate-200">
                      {formatSharingType(roomInfo.sharingType)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Occupancy:</span>
                    <span className="font-semibold text-white">
                      {roomInfo.currentOccupancy} / {roomInfo.capacity} Residents
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agreed Monthly Rent:</span>
                    <span className="font-bold text-amber-400">
                      ₹{Number(registration.monthlyRent || 0).toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Check-in Date</span>
                  <span className="font-semibold text-slate-200">
                    {formatDate(registration.checkInDate)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Security Deposit</span>
                  <span className="font-semibold text-slate-200">
                    {registration.securityDeposit !== null &&
                    registration.securityDeposit !== undefined &&
                    String(registration.securityDeposit).trim() !== ''
                      ? registration.securityDeposit
                      : 'Not provided'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* IDENTITY DOCUMENT */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>IDENTITY DOCUMENT</span>
              </h3>
              {registration.googleDriveFileId || registration.identityDocumentUrl ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Document Available</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
                  No Document Provided
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-3">
              {registration.googleDriveFileId || registration.identityDocumentUrl ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <FileText className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-white text-xs truncate">
                        {registration.fullName}&apos;s ID Proof
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Authenticated Google Drive Document
                      </p>
                      {registration.googleDriveFileId && (
                        <p className="text-[10px] font-mono text-slate-500 truncate">
                          File ID: {registration.googleDriveFileId}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    {(() => {
                      const directDriveUrl =
                        registration.identityDocumentUrl ||
                        (registration.googleDriveFileId
                          ? `https://drive.google.com/file/d/${registration.googleDriveFileId}/view?usp=drivesdk`
                          : null);

                      return (
                        <a
                          href={directDriveUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-[0.99]"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Document</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                        </a>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 space-y-1 text-slate-500">
                  <Shield className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="font-semibold text-xs text-slate-400">No Document Attached</p>
                  <p className="text-[11px]">No identity document was submitted in this registration.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      <Modal
        isOpen={isApproveOpen}
        onClose={() => !isActionLoading && setIsApproveOpen(false)}
        title={`Approve & Onboard ${registration.fullName}`}
        subtitle="This action will create an active resident record and initialize payment dues."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Applicant:</span>
              <span className="font-bold text-white">{registration.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned Room:</span>
              <span className="font-bold text-amber-400">Room {registration.requestedRoomNumber || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Agreed Monthly Rent:</span>
              <span className="font-bold text-amber-400">₹{Number(registration.monthlyRent || 0).toLocaleString('en-IN')}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Security Deposit:</span>
              <span className="font-semibold text-slate-200">
                {registration.securityDeposit !== null &&
                registration.securityDeposit !== undefined &&
                String(registration.securityDeposit).trim() !== ''
                  ? registration.securityDeposit
                  : 'Not provided'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Approving this submission will onboard the resident, increment room occupancy, and create the initial billing ledger.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => setIsApproveOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleApprove}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Confirm & Approve</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => !isActionLoading && setIsRejectOpen(false)}
        title={`Reject ${registration.fullName}`}
        subtitle="Please specify a reason for rejecting this registration."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Rejection Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Room capacity unavailable, invalid KYC documents, duplicate submission..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => setIsRejectOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isActionLoading}
              onClick={handleReject}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Confirm Rejection</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

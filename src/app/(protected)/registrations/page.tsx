'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileCheck,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Check,
  X,
  DoorOpen,
  Calendar,
  Building,
  Phone,
  User,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { maskAadhaar } from '@/lib/residentStats';

export default function RegistrationsPage() {
  const [mounted, setMounted] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, new: 0, underReview: 0, approved: 0, rejected: 0 });
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<any>(null);
  const [latestSync, setLatestSync] = useState<any>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Quick Action Modals
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchRegistrations();
    fetchRooms();
    fetchSyncStatus();
  }, [statusFilter, roomFilter, page]);

  const fetchRegistrations = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (roomFilter !== 'ALL') params.append('room', roomFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', page.toString());
      params.append('limit', '15');

      const res = await fetch(`/api/registrations?${params.toString()}`);
      const data = await res.json();

      if (data.registrations) {
        setRegistrations(data.registrations);
        setTotalPages(data.pagination?.totalPages || 1);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch registrations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      if (data.rooms) setRooms(data.rooms);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/sync/google-forms');
      const data = await res.json();
      if (data.latestSync) setLatestSync(data.latestSync);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    }
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      setSyncSummary(null);
      setActionError(null);

      const res = await fetch('/api/sync/google-forms', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sync failed.');
      }

      setSyncSummary(data);
      setActionSuccess(
        `Sync completed: ${data.newCount} new, ${data.updatedCount} updated, ${data.skippedCount} skipped.`
      );
      fetchRegistrations();
      fetchSyncStatus();
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRegistrations();
  };

  const handleApprove = async () => {
    if (!selectedReg) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/registrations/${selectedReg.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber: selectedReg.requestedRoomNumber,
          securityDeposit: selectedReg.securityDeposit ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve registration.');

      setActionSuccess(`${selectedReg.fullName} approved and onboarded to Room ${selectedReg.requestedRoomNumber}!`);
      setIsApproveOpen(false);
      setSelectedReg(null);
      fetchRegistrations();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReg) return;
    if (!rejectionReason.trim()) {
      setActionError('Please specify a reason for rejection.');
      return;
    }

    setIsActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/registrations/${selectedReg.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject registration.');

      setActionSuccess(`Registration for ${selectedReg.fullName} rejected.`);
      setIsRejectOpen(false);
      setSelectedReg(null);
      setRejectionReason('');
      fetchRegistrations();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMarkReview = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/registrations/${id}/review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update review status.');

      setActionSuccess(`Registration for ${name} marked as Under Review.`);
      fetchRegistrations();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header & Sync Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Registrations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              Google Forms Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review submissions, verify identity proofs, check room capacity, and onboard residents.
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            suppressHydrationWarning
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-slate-950 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Responses...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Integration Status Bar */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Google Forms / Sheets Connected</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400" suppressHydrationWarning>
              Last Synced:{' '}
              {mounted && latestSync?.completedAt
                ? new Date(latestSync.completedAt).toLocaleString('en-IN')
                : 'Synced just now'}{' '}
              • Status: <span className="text-emerald-400 font-semibold">Healthy</span>
            </p>
          </div>
        </div>

        {syncSummary && (
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-amber-400 font-bold">New: {syncSummary.newCount}</span>
            <span className="text-slate-600">•</span>
            <span className="text-sky-400">Updated: {syncSummary.updatedCount}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">Skipped: {syncSummary.skippedCount}</span>
            <span className="text-slate-600">•</span>
            <span className={syncSummary.errorCount > 0 ? 'text-rose-400' : 'text-slate-400'}>
              Errors: {syncSummary.errorCount}
            </span>
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

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => { setStatusFilter('ALL'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">All Submissions</span>
          <span className="text-xl font-black text-white">{stats.total}</span>
        </div>

        <div
          onClick={() => { setStatusFilter('NEW'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'NEW'
              ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 text-sky-400">New Pending</span>
          <span className="text-xl font-black text-sky-400">{stats.new}</span>
        </div>

        <div
          onClick={() => { setStatusFilter('UNDER_REVIEW'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'UNDER_REVIEW'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 text-amber-400">Under Review</span>
          <span className="text-xl font-black text-amber-400">{stats.underReview}</span>
        </div>

        <div
          onClick={() => { setStatusFilter('APPROVED'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 text-emerald-400">Approved</span>
          <span className="text-xl font-black text-emerald-400">{stats.approved}</span>
        </div>

        <div
          onClick={() => { setStatusFilter('REJECTED'); setPage(1); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 text-rose-400">Rejected</span>
          <span className="text-xl font-black text-rose-400">{stats.rejected}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, mobile, room, college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            suppressHydrationWarning
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={roomFilter}
            onChange={(e) => { setRoomFilter(e.target.value); setPage(1); }}
            suppressHydrationWarning
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.roomNumber}>
                Room {r.roomNumber}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            suppressHydrationWarning
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Registrations Directory (Desktop Table & Mobile Cards) */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <span>Loading registrations...</span>
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-3">
            <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-300">No registrations found.</p>
            <p className="text-slate-500 text-[11px]">
              Click &quot;Sync Now&quot; to fetch responses from the Google Form spreadsheet.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Applicant Name</th>
                    <th className="py-3.5 px-4">Mobile</th>
                    <th className="py-3.5 px-4">Requested Room</th>
                    <th className="py-3.5 px-4">Check-in Date</th>
                    <th className="py-3.5 px-4">Occupation</th>
                    <th className="py-3.5 px-4">Company / College</th>
                    <th className="py-3.5 px-4">Submitted At</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {registrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/registrations/${reg.id}`}
                            className="font-bold text-white hover:text-amber-400 transition-colors"
                          >
                            {reg.fullName}
                          </Link>
                          {new Date(reg.updatedAt).getTime() - new Date(reg.createdAt).getTime() > 2000 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20" title="Updated via Google Forms">
                              Edited
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium">{reg.mobileNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-[11px]">
                          Room {reg.requestedRoomNumber || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {reg.checkInDate ? new Date(reg.checkInDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-medium">{reg.occupation || 'Student'}</td>
                      <td className="py-3.5 px-4 text-slate-400 max-w-[150px] truncate">
                        {reg.companyOrCollegeName || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {reg.sourceSubmittedAt
                          ? new Date(reg.sourceSubmittedAt).toLocaleDateString('en-IN')
                          : new Date(reg.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={reg.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/registrations/${reg.id}`}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            title="View Full Registration Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {reg.status === 'NEW' && (
                            <button
                              type="button"
                              onClick={() => handleMarkReview(reg.id, reg.fullName)}
                              className="px-2 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold transition-all"
                              title="Mark as Under Review"
                            >
                              Review
                            </button>
                          )}

                          {(reg.status === 'NEW' || reg.status === 'UNDER_REVIEW') && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setSelectedReg(reg); setIsApproveOpen(true); }}
                                className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                                title="Approve & Onboard Resident"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setSelectedReg(reg); setIsRejectOpen(true); }}
                                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                                title="Reject Submission"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden divide-y divide-slate-800 p-3 space-y-3">
              {registrations.map((reg) => (
                <div key={reg.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/registrations/${reg.id}`}
                        className="font-bold text-white text-sm hover:text-amber-400"
                      >
                        {reg.fullName}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">{reg.mobileNumber}</p>
                    </div>
                    <StatusBadge status={reg.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Room</span>
                      <span className="font-bold text-amber-400">Room {reg.requestedRoomNumber || 'N/A'}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Check-in</span>
                      <span className="font-semibold text-slate-200">
                        {reg.checkInDate ? new Date(reg.checkInDate).toLocaleDateString('en-IN') : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <Link
                      href={`/registrations/${reg.id}`}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Link>

                    {(reg.status === 'NEW' || reg.status === 'UNDER_REVIEW') && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setSelectedReg(reg); setIsApproveOpen(true); }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedReg(reg); setIsRejectOpen(true); }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-400 text-xs font-bold flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Approval Confirmation Modal */}
      <Modal
        isOpen={isApproveOpen}
        onClose={() => !isActionLoading && setIsApproveOpen(false)}
        title={`Approve ${selectedReg?.fullName}`}
        subtitle={`Validate room capacity and onboard resident to Room ${selectedReg?.requestedRoomNumber || 'N/A'}.`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Applicant:</span>
              <span className="font-bold text-white">{selectedReg?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mobile:</span>
              <span className="font-semibold text-slate-200">{selectedReg?.mobileNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Requested Room:</span>
              <span className="font-bold text-amber-400">Room {selectedReg?.requestedRoomNumber || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Security Deposit:</span>
              <span className="font-semibold text-slate-200">
                {selectedReg?.securityDeposit !== null &&
                selectedReg?.securityDeposit !== undefined &&
                String(selectedReg.securityDeposit).trim() !== ''
                  ? selectedReg.securityDeposit
                  : 'Not provided'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Approving this submission will verify available room capacity, create an active resident record, and generate the initial rent billing ledger.
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
        title={`Reject ${selectedReg?.fullName}`}
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
              type="button"
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

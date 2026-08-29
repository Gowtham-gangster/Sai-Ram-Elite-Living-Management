'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  User,
  ArrowRight,
  TrendingUp,
  Download,
  FileText,
  Shield,
  ExternalLink,
  Layers,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { formatCurrency, formatIndianDate } from '@/lib/utils';
import { Badge, StatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function PaymentsPage() {
  const [mounted, setMounted] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [roomBreakdown, setRoomBreakdown] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalDues: 0,
    collectedAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    totalCount: 0,
    paidResidentsCount: 0,
    pendingResidentsCount: 0,
    paidCount: 0,
    pendingCount: 0,
    submittedCount: 0,
    overdueCount: 0,
  });

  const [activeTab, setActiveTab] = useState<'ledger' | 'reconciliation'>('ledger');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('2026-08');

  // Modals state
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);
  const [isRetryingReceipt, setIsRetryingReceipt] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Manual payment form state
  const [manualForm, setManualForm] = useState({
    monthlyPaymentId: '',
    amountPaid: '',
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().slice(0, 10),
    transactionReference: '',
    notes: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (selectedMonth && selectedMonth !== 'ALL') params.append('month', selectedMonth);

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Unable to load payment records.');
      const data = await res.json();
      setPayments(data.payments || []);
      setRoomBreakdown(data.roomBreakdown || []);
      setSummary(
        data.summary || {
          totalDues: 0,
          collectedAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
          totalCount: 0,
          paidResidentsCount: 0,
          pendingResidentsCount: 0,
          paidCount: 0,
          pendingCount: 0,
          submittedCount: 0,
          overdueCount: 0,
        }
      );
    } catch (err: any) {
      setError(err.message || 'Error loading payments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchPayments();
    }
  }, [mounted, statusFilter, selectedMonth]);

  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingRecord(true);
      setActionError(null);

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyPaymentId: manualForm.monthlyPaymentId,
          amountPaid: Number(manualForm.amountPaid),
          paymentMethod: manualForm.paymentMethod,
          paymentDate: new Date(manualForm.paymentDate),
          transactionReference: manualForm.transactionReference || undefined,
          notes: manualForm.notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record manual payment.');

      setActionSuccess('Manual payment recorded and PDF receipt generated successfully.');
      setIsRecordOpen(false);
      fetchPayments();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Error recording manual payment.');
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  const handleRetryReceiptUpload = async (paymentId: string) => {
    try {
      setIsRetryingReceipt(true);
      setActionError(null);

      const res = await fetch(`/api/payments/${paymentId}/retry-receipt`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retry receipt upload.');

      setActionSuccess('Receipt PDF uploaded to Google Drive successfully.');
      fetchPayments();
      if (selectedPayment) {
        setSelectedPayment({
          ...selectedPayment,
          receipts: [{ ...selectedPayment.receipts?.[0], status: 'READY', googleDriveFileId: data.receipt?.googleDriveFileId }],
        });
      }
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to retry receipt upload.');
    } finally {
      setIsRetryingReceipt(false);
    }
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Payment Management & Reconciliation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              Production Ledgers
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time rent collection tracking, verified transaction management, and Google Drive receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Billing Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="2026-08" className="bg-slate-900">August 2026</option>
              <option value="2026-07" className="bg-slate-900">July 2026</option>
              <option value="2026-06" className="bg-slate-900">June 2026</option>
              <option value="ALL" className="bg-slate-900">All Billing Months</option>
            </select>
          </div>

          <a
            href={`/api/payments/export?month=${selectedMonth}&status=${statusFilter}`}
            download
            className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 transition-all hover:border-slate-700 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Excel (.xlsx)</span>
          </a>

          <button
            type="button"
            onClick={() => setIsRecordOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Manual Payment</span>
          </button>

          <button
            type="button"
            onClick={fetchPayments}
            className="p-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Refresh payment records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 6 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. TOTAL DUE */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Total Due</div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1">{formatCurrency(summary.totalDues)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Expected Rent</div>
        </div>

        {/* 2. TOTAL COLLECTED */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[9px] uppercase font-bold tracking-wider text-emerald-400">Total Collected</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{formatCurrency(summary.collectedAmount)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Verified Received</div>
        </div>

        {/* 3. PENDING */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[9px] uppercase font-bold tracking-wider text-amber-400">Pending</div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{formatCurrency(summary.pendingAmount)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Awaiting Settlement</div>
        </div>

        {/* 4. OVERDUE */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[9px] uppercase font-bold tracking-wider text-rose-400">Overdue</div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">{formatCurrency(summary.overdueAmount)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Past Due Date</div>
        </div>

        {/* 5. PAID RESIDENTS */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Paid Residents</div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1">{summary.paidResidentsCount}</div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-1">Cleared Rent</div>
        </div>

        {/* 6. PENDING RESIDENTS */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Pending Residents</div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{summary.pendingResidentsCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Unsettled Residents</div>
        </div>
      </div>

      {/* Tabs Switcher: Ledger vs Room Reconciliation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Ledgers ({payments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reconciliation')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'reconciliation'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Room-Wise Reconciliation ({roomBreakdown.length} Rooms)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Payment Ledgers */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm font-bold text-white">Monthly Rent Records</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid Only</option>
                <option value="PENDING">Pending Only</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="SUBMITTED">Submitted / Review</option>
              </select>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchPayments();
              }}
              className="relative w-full sm:w-72"
            >
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search resident, room, mobile, ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
              />
            </form>
          </div>

          {payments.length === 0 ? (
            <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
              <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-xs font-bold text-slate-300">No payment records found</h3>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                No monthly billing records match your selected month and filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Resident & Mobile</th>
                    <th className="p-3">Room</th>
                    <th className="p-3">Billing Month</th>
                    <th className="p-3">Rent / Total Due</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Payment Reference</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Reminder State</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {payments.map((p: any) => {
                    const latestReminder = p.reminders?.[0] || p.paymentReminders?.[0];
                    const latestReceipt = p.receipts?.[0];
                    const isVerifiedPaid = p.status === 'PAID';

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/20">
                        <td className="p-3">
                          <div className="font-bold text-white">{p.resident?.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.resident?.phone}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-200">Room {p.room?.roomNumber}</span>
                        </td>
                        <td className="p-3 font-medium text-amber-400">{p.billingMonth}</td>
                        <td className="p-3">
                          <div className="font-bold text-white">{formatCurrency(p.totalAmountDue)}</div>
                          <div className="text-[10px] text-slate-500">Rent: {formatCurrency(p.rentAmount)}</div>
                        </td>
                        <td className="p-3">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="p-3">
                          {p.transactionReference ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-[10px] text-amber-300 block truncate max-w-[120px]" title={p.transactionReference}>
                                {p.transactionReference}
                              </span>
                              <span className="text-[9px] text-slate-500 font-semibold uppercase">
                                {p.gatewayProvider || p.paymentMethod || 'UPI'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-300">
                          {formatIndianDate(p.dueDate)}
                        </td>
                        <td className="p-3">
                          {isVerifiedPaid ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold">
                              Cancelled (Paid)
                            </span>
                          ) : latestReminder ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                              {latestReminder.status === 'SENT' ? 'Reminder Sent' : 'Scheduled'}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setIsDetailsOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Details
                            </button>

                            {latestReceipt && (
                              <a
                                href={`/api/pay/receipt/${latestReceipt.downloadToken || latestReceipt.receiptNumber}`}
                                download
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                                title="Download PDF Receipt"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Room-Wise Collection Reconciliation */}
      {/* ========================================================================= */}
      {activeTab === 'reconciliation' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div>
            <h2 className="text-sm font-bold text-white">Room-Level Collection Reconciliation</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown of expected rent vs verified collections aggregated directly from individual resident ledgers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Room</th>
                  <th className="p-3">Active Residents</th>
                  <th className="p-3">Expected Rent</th>
                  <th className="p-3">Verified Collected</th>
                  <th className="p-3">Outstanding Dues</th>
                  <th className="p-3">Collection Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {roomBreakdown.map((r: any) => {
                  const pct = r.expected > 0 ? Math.round((r.collected / r.expected) * 100) : 0;

                  return (
                    <tr key={r.roomNumber} className="hover:bg-slate-800/20">
                      <td className="p-3 font-bold text-white">Room {r.roomNumber}</td>
                      <td className="p-3 text-slate-300 font-semibold">{r.residentCount} resident(s)</td>
                      <td className="p-3 font-mono font-bold text-white">{formatCurrency(r.expected)}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{formatCurrency(r.collected)}</td>
                      <td className="p-3 font-mono font-bold text-amber-400">{formatCurrency(r.pending)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct === 100 ? 'bg-emerald-400' : pct > 0 ? 'bg-amber-400' : 'bg-slate-700'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Payment Details & Receipt Status */}
      {/* ========================================================================= */}
      {isDetailsOpen && selectedPayment && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedPayment(null);
          }}
          title="Payment Record Details"
        >
          <div className="space-y-4 text-xs text-slate-300">
            {/* Status Header */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Verification Status</span>
                <div className="mt-1">
                  {selectedPayment.status === 'PAID' ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✓ Server-Verified PAID</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                      <Clock className="w-4 h-4 animate-pulse" />
                      <span>⏳ Awaiting Verification ({selectedPayment.status})</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Due</span>
                <div className="text-base font-black text-white mt-0.5">
                  {formatCurrency(selectedPayment.totalAmountDue)}
                </div>
              </div>
            </div>

            {/* Resident & Room Grid */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Resident Name:</span>
                <span className="font-bold text-white">{selectedPayment.resident?.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registered Mobile:</span>
                <span className="font-mono text-slate-200">{selectedPayment.resident?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Room:</span>
                <span className="font-semibold text-slate-200">Room {selectedPayment.room?.roomNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Month:</span>
                <span className="font-semibold text-amber-400">{selectedPayment.billingMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly Rent Accommodation:</span>
                <span className="font-semibold text-white">{formatCurrency(selectedPayment.rentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-mono text-slate-300">{formatIndianDate(selectedPayment.dueDate)}</span>
              </div>
              {selectedPayment.paidDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Settled On:</span>
                  <span className="font-mono text-emerald-400">{formatIndianDate(selectedPayment.paidDate)}</span>
                </div>
              )}
            </div>

            {/* Transaction & Reference Details */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Gateway & Reference</span>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Payment Reference:</span>
                <span className="font-mono text-amber-300 font-bold">{selectedPayment.transactionReference || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gateway Provider:</span>
                <span className="font-semibold text-slate-200">{selectedPayment.gatewayProvider || selectedPayment.paymentMethod || 'UPI'}</span>
              </div>
              {selectedPayment.gatewayPaymentId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider Payment ID:</span>
                  <span className="font-mono text-slate-300">{selectedPayment.gatewayPaymentId}</span>
                </div>
              )}
            </div>

            {/* Receipt & Google Drive Status */}
            {selectedPayment.status === 'PAID' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Official PDF Receipt</span>
                  {selectedPayment.receipts?.[0]?.googleDriveFileId ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      Google Drive: READY
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                      Google Drive: PENDING
                    </span>
                  )}
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Number:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {selectedPayment.receipts?.[0]?.receiptNumber || selectedPayment.receiptNumber || 'Generating...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`/api/pay/receipt/${selectedPayment.receipts?.[0]?.downloadToken || selectedPayment.receipts?.[0]?.receiptNumber || selectedPayment.id}`}
                    download
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF Receipt</span>
                  </a>

                  <button
                    type="button"
                    disabled={isRetryingReceipt}
                    onClick={() => handleRetryReceiptUpload(selectedPayment.id)}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Retry Google Drive upload"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${isRetryingReceipt ? 'animate-spin' : ''}`} />
                    <span>Retry Drive</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Record Manual Admin Payment */}
      {/* ========================================================================= */}
      {isRecordOpen && (
        <Modal
          isOpen={isRecordOpen}
          onClose={() => setIsRecordOpen(false)}
          title="Record Manual Rent Payment (Admin)"
        >
          <form onSubmit={handleRecordManualPayment} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Select Resident Dues Bill *</label>
              <select
                required
                value={manualForm.monthlyPaymentId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const found = payments.find((p) => p.id === pId);
                  setManualForm({
                    ...manualForm,
                    monthlyPaymentId: pId,
                    amountPaid: found ? String(found.totalAmountDue) : '',
                  });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Choose Resident Monthly Payment --</option>
                {payments
                  .filter((p) => p.status !== 'PAID')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.resident?.fullName} (Room {p.room?.roomNumber}) • {p.billingMonth} • Due: ₹{p.totalAmountDue}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Amount Paid (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={manualForm.amountPaid}
                  onChange={(e) => setManualForm({ ...manualForm, amountPaid: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Payment Method *</label>
                <select
                  value={manualForm.paymentMethod}
                  onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">Direct UPI</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={manualForm.paymentDate}
                  onChange={(e) => setManualForm({ ...manualForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">UTR / Transaction Ref</label>
                <input
                  type="text"
                  placeholder="Optional reference"
                  value={manualForm.transactionReference}
                  onChange={(e) => setManualForm({ ...manualForm, transactionReference: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Admin Notes</label>
              <textarea
                rows={2}
                placeholder="Offline settlement notes..."
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRecordOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRecord || !manualForm.monthlyPaymentId}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingRecord ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Record & Generate Receipt</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

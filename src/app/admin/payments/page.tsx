'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ExternalLink,
  Edit2,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  XCircle,
  FileText,
  DollarSign,
  Building,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [rooms, setRooms] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [residentFilter, setResidentFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'monthDesc' | 'monthAsc' | 'amountDesc' | 'amountAsc' | 'nameAsc' | 'nameDesc' | 'roomAsc' | 'dateDesc'>('monthDesc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View Details Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [inspectedPayment, setInspectedPayment] = useState<any>(null);

  // Record Payment Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<any>(null);
  const [recordForm, setRecordForm] = useState({
    monthlyPaymentId: '',
    amountPaid: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'UPI',
    transactionReference: '',
    notes: '',
  });

  // Edit Bill Modal State
  const [editBillModalOpen, setEditBillModalOpen] = useState(false);
  const [selectedPaymentForEdit, setSelectedPaymentForEdit] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    rentAmount: 0,
    maintenanceAmount: 500,
    penaltyAmount: 0,
    discountAmount: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Status Change / Review Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedPaymentForStatus, setSelectedPaymentForStatus] = useState<any>(null);
  const [statusForm, setStatusForm] = useState({
    status: 'PAID',
    notes: '',
  });

  // Generate Dues Modal State
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Feedback State
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchMetadata();
  }, []);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (data.payments) {
        setPayments(data.payments);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [roomsRes, residentsRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/residents'),
      ]);
      const dataRooms = await roomsRes.json();
      const dataResidents = await residentsRes.json();
      if (dataRooms.rooms) setRooms(dataRooms.rooms);
      if (dataResidents.residents) setResidents(dataResidents.residents);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  // Available unique billing months for filter
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(payments.map((p) => p.billingMonth))).sort().reverse();
    if (!months.includes('2026-08')) months.push('2026-08');
    if (!months.includes('2026-09')) months.push('2026-09');
    return months;
  }, [payments]);

  // Filtered & Sorted Payments
  const processedPayments = useMemo(() => {
    return payments
      .filter((p) => {
        // Search
        if (search) {
          const q = search.toLowerCase();
          const matchName = p.resident?.fullName?.toLowerCase().includes(q);
          const matchPhone = p.resident?.phone?.includes(q);
          const matchRoom = p.room?.roomNumber?.toLowerCase().includes(q);
          const matchReceipt = p.receiptNumber?.toLowerCase().includes(q);
          const matchRef = p.transactionReference?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchRoom && !matchReceipt && !matchRef) return false;
        }

        // Month
        if (selectedMonth !== 'ALL' && p.billingMonth !== selectedMonth) return false;

        // Status
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;

        // Room
        if (roomFilter !== 'ALL' && p.roomId !== roomFilter) return false;

        // Resident
        if (residentFilter !== 'ALL' && p.residentId !== residentFilter) return false;

        // Method
        if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'monthDesc') return b.billingMonth.localeCompare(a.billingMonth);
        if (sortBy === 'monthAsc') return a.billingMonth.localeCompare(b.billingMonth);
        if (sortBy === 'amountDesc') return b.totalAmountDue - a.totalAmountDue;
        if (sortBy === 'amountAsc') return a.totalAmountDue - b.totalAmountDue;
        if (sortBy === 'nameAsc') return a.resident.fullName.localeCompare(b.resident.fullName);
        if (sortBy === 'nameDesc') return b.resident.fullName.localeCompare(a.resident.fullName);
        if (sortBy === 'roomAsc') return a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true });
        if (sortBy === 'dateDesc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return 0;
      });
  }, [payments, search, selectedMonth, statusFilter, roomFilter, residentFilter, methodFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(processedPayments.length / pageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedPayments.slice(start, start + pageSize);
  }, [processedPayments, currentPage, pageSize]);

  const handleOpenDetailModal = (payment: any) => {
    setInspectedPayment(payment);
    setDetailModalOpen(true);
  };

  const handleOpenRecordPayment = (payment: any) => {
    setSelectedPaymentForRecord(payment);
    setRecordForm({
      monthlyPaymentId: payment.id,
      amountPaid: payment.totalAmountDue,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: payment.paymentMethod || 'UPI',
      transactionReference: payment.transactionReference || '',
      notes: '',
    });
    setActionError(null);
    setRecordModalOpen(true);
  };

  const handleOpenEditBill = (payment: any) => {
    setSelectedPaymentForEdit(payment);
    setEditForm({
      rentAmount: payment.rentAmount,
      maintenanceAmount: payment.maintenanceAmount || 0,
      penaltyAmount: payment.penaltyAmount || 0,
      discountAmount: payment.discountAmount || 0,
      dueDate: new Date(payment.dueDate).toISOString().slice(0, 10),
      notes: payment.notes || '',
    });
    setActionError(null);
    setEditBillModalOpen(true);
  };

  const handleOpenStatusModal = (payment: any, presetStatus?: string) => {
    setSelectedPaymentForStatus(payment);
    setStatusForm({
      status: presetStatus || (payment.status === 'SUBMITTED' ? 'PAID' : payment.status),
      notes: '',
    });
    setActionError(null);
    setStatusModalOpen(true);
  };

  // Submit Record Payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      setRecordModalOpen(false);
      setActionSuccess(`Payment of ₹${recordForm.amountPaid.toLocaleString('en-IN')} recorded & Receipt generated.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPayments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to record payment');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Bill
  const handleEditBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForEdit) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/payments/${selectedPaymentForEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update billing line items');
      }

      setEditBillModalOpen(false);
      setActionSuccess(`Billing amounts updated for ${selectedPaymentForEdit.resident?.fullName}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPayments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to edit bill');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Status Change
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForStatus) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/payments/${selectedPaymentForStatus.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      setStatusModalOpen(false);
      setActionSuccess(`Payment status updated to ${statusForm.status}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPayments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update payment status');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Generate Monthly Dues
  const handleGenerateDues = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/payments/generate-dues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingMonth: generateMonth }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate monthly bills');
      }

      setGenerateModalOpen(false);
      setActionSuccess(data.message);
      setTimeout(() => setActionSuccess(null), 5000);
      setSelectedMonth(generateMonth);
      fetchPayments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate bills');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Monthly Payment Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              <span>Manual Record Ledger (No Gateways)</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track monthly room dues, verify manual bank/UPI transfers, manage status lifecycles, and issue official receipts.
          </p>
        </div>

        <button
          onClick={() => {
            setActionError(null);
            setGenerateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Calendar className="w-4 h-4" />
          <span>Generate Monthly Dues</span>
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Billed</p>
          <div className="text-xl sm:text-2xl font-black text-white mt-1">
            {isLoading ? <div className="h-7 w-24 bg-slate-800 rounded-lg animate-pulse mt-1" /> : `₹${(summary.totalDues || 0).toLocaleString('en-IN')}`}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{summary.totalCount || 0} total records</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collected Revenue</p>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            {isLoading ? <div className="h-7 w-24 bg-slate-800 rounded-lg animate-pulse mt-1" /> : `₹${(summary.collectedAmount || 0).toLocaleString('en-IN')}`}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{summary.paidCount || 0} paid & verified</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Dues</p>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
            {isLoading ? <div className="h-7 w-24 bg-slate-800 rounded-lg animate-pulse mt-1" /> : `₹${(summary.pendingAmount || 0).toLocaleString('en-IN')}`}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{summary.pendingCount || 0} unpaid accounts</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submitted / Overdue</p>
          {isLoading ? (
            <div className="h-7 w-24 bg-slate-800 rounded-lg animate-pulse mt-1" />
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-sky-400">
                {summary.submittedCount || 0}
              </span>
              <span className="text-xs text-slate-500">review /</span>
              <span className="text-xl sm:text-2xl font-black text-rose-400">
                {summary.overdueCount || 0}
              </span>
              <span className="text-xs text-slate-500">overdue</span>
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-0.5">Requiring attention</p>
        </div>
      </div>

      {/* Control Bar: Multi-Factor Filters & Sorting */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search resident, room #, receipt, or UTR ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Month Filter */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="ALL">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending (Unpaid)</option>
              <option value="SUBMITTED">Submitted (Review)</option>
              <option value="PAID">Paid & Verified</option>
              <option value="OVERDUE">Overdue</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Methods</option>
              <option value="UPI">UPI Transfer</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="monthDesc">Month: Newest</option>
              <option value="monthAsc">Month: Oldest</option>
              <option value="amountDesc">Amount: High to Low</option>
              <option value="amountAsc">Amount: Low to High</option>
              <option value="nameAsc">Resident: A to Z</option>
              <option value="roomAsc">Room: Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Payment Records Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading payment ledger...</p>
          </div>
        ) : processedPayments.length === 0 ? (
          <div className="p-16 text-center">
            <CreditCard className="w-14 h-14 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No payment records found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No bills found for the selected filter. Click &quot;Generate Monthly Dues&quot; to batch create bills for active residents.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(search || selectedMonth !== 'ALL' || statusFilter !== 'ALL' || methodFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedMonth('ALL');
                    setStatusFilter('ALL');
                    setMethodFilter('ALL');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={() => setGenerateModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 text-xs font-bold rounded-xl shadow-md"
              >
                + Generate Dues
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room</th>
                    <th className="py-3.5 px-4 font-bold">Billing Month</th>
                    <th className="py-3.5 px-4 font-bold">Bill Breakdown</th>
                    <th className="py-3.5 px-4 font-bold">Total Amount Due</th>
                    <th className="py-3.5 px-4 font-bold">Payment Status</th>
                    <th className="py-3.5 px-4 font-bold">Receipt / Ref</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Resident */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-white text-sm">{p.resident.fullName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{p.resident.phone}</div>
                      </td>

                      {/* Room */}
                      <td className="py-4 px-4">
                        <span className="font-mono font-black text-brand-400 text-sm">
                          Room {p.room.roomNumber}
                        </span>
                        <div className="text-[10px] text-slate-500">Floor {p.room.floor}</div>
                      </td>

                      {/* Month & Due Date */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-200">{p.billingMonth}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Due: {new Date(p.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>

                      {/* Bill Breakdown */}
                      <td className="py-4 px-4 text-[11px] text-slate-400">
                        <div>Rent: ₹{p.rentAmount}</div>
                        {p.maintenanceAmount > 0 && <div>Maint: +₹{p.maintenanceAmount}</div>}
                        {p.penaltyAmount > 0 && <div className="text-rose-400">Late Fee: +₹{p.penaltyAmount}</div>}
                        {p.discountAmount > 0 && <div className="text-emerald-400">Discount: -₹{p.discountAmount}</div>}
                      </td>

                      {/* Total Amount Due */}
                      <td className="py-4 px-4">
                        <span className="font-black text-white text-sm">
                          ₹{p.totalAmountDue.toLocaleString('en-IN')}
                        </span>
                        {p.paidDate && (
                          <div className="text-[10px] text-emerald-400 mt-0.5">
                            Paid {new Date(p.paidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <StatusBadge status={p.status} />
                        {p.paymentMethod && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Mode: <strong className="text-slate-300">{p.paymentMethod}</strong>
                          </div>
                        )}
                      </td>

                      {/* Receipt / Ref */}
                      <td className="py-4 px-4 font-mono text-xs">
                        {p.receiptNumber ? (
                          <Link
                            href={`/admin/receipts/${p.receiptNumber}`}
                            className="font-bold text-brand-400 hover:underline inline-flex items-center gap-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>{p.receiptNumber}</span>
                          </Link>
                        ) : p.transactionReference ? (
                          <span className="text-slate-300 text-[11px] truncate max-w-[120px] block">
                            {p.transactionReference}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Unpaid</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => handleOpenDetailModal(p)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Payment Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Bill */}
                          {p.status !== 'PAID' && (
                            <button
                              onClick={() => handleOpenEditBill(p)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Bill Breakdown"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Record Payment Button */}
                          {p.status !== 'PAID' ? (
                            <button
                              onClick={() => handleOpenRecordPayment(p)}
                              className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-lg shadow-sm flex items-center gap-1 transition-all"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Record Paid</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenStatusModal(p)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 transition-colors"
                            >
                              Status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="text-slate-400">
                Showing{' '}
                <strong className="text-white">
                  {(currentPage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-white">
                  {Math.min(currentPage * pageSize, processedPayments.length)}
                </strong>{' '}
                of <strong className="text-white">{processedPayments.length}</strong> payment bills
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-semibold text-slate-300">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW PAYMENT DETAILS MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Payment Details: ${inspectedPayment?.resident?.fullName}`}
        subtitle={`Room ${inspectedPayment?.room?.roomNumber} • Billing Month: ${inspectedPayment?.billingMonth}`}
        maxWidth="lg"
      >
        {inspectedPayment && (
          <div className="space-y-5 text-xs">
            {/* Status Header */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount Due</span>
                <span className="text-2xl font-black text-white mt-0.5 block">
                  ₹{inspectedPayment.totalAmountDue.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Billing Status</span>
                <StatusBadge status={inspectedPayment.status} />
              </div>
            </div>

            {/* Line Items Breakdown */}
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Itemized Bill Breakdown
              </h4>
              <div className="divide-y divide-slate-800 text-slate-300">
                <div className="py-1.5 flex justify-between">
                  <span>Room Accommodation Rent</span>
                  <span className="font-bold text-white">₹{inspectedPayment.rentAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span>Maintenance & Common Utilities</span>
                  <span className="font-bold text-white">₹{(inspectedPayment.maintenanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {inspectedPayment.penaltyAmount > 0 && (
                  <div className="py-1.5 flex justify-between text-rose-400">
                    <span>Late Fee Penalty</span>
                    <span className="font-bold">+₹{inspectedPayment.penaltyAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {inspectedPayment.discountAmount > 0 && (
                  <div className="py-1.5 flex justify-between text-emerald-400">
                    <span>Discount Applied</span>
                    <span className="font-bold">-₹{inspectedPayment.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Verification / Metadata */}
            <div className="grid grid-cols-2 gap-4 text-slate-300">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Due Date</span>
                <span className="font-bold text-white">
                  {new Date(inspectedPayment.dueDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Payment Date</span>
                <span className="font-bold text-white">
                  {inspectedPayment.paidDate
                    ? new Date(inspectedPayment.paidDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Not Paid Yet'}
                </span>
              </div>
            </div>

            {inspectedPayment.receiptNumber && (
              <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-brand-300 font-semibold block">Official Receipt Generated:</span>
                  <span className="font-mono font-bold text-brand-400">{inspectedPayment.receiptNumber}</span>
                </div>
                <Link
                  href={`/admin/receipts/${inspectedPayment.receiptNumber}`}
                  className="px-3 py-1 bg-brand-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-brand-400 transition-colors inline-flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>View Receipt</span>
                </Link>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Close Overview
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title={`Record Payment: ${selectedPaymentForRecord?.resident?.fullName}`}
        subtitle={`Room ${selectedPaymentForRecord?.room?.roomNumber} • ${selectedPaymentForRecord?.billingMonth}`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Amount Paid (₹) <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              value={recordForm.amountPaid}
              onChange={(e) => setRecordForm({ ...recordForm, amountPaid: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
              <select
                value={recordForm.paymentMethod}
                onChange={(e) => setRecordForm({ ...recordForm, paymentMethod: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS)</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={recordForm.paymentDate}
                onChange={(e) => setRecordForm({ ...recordForm, paymentDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Transaction Reference / UTR Number
            </label>
            <input
              type="text"
              placeholder="e.g. UPI/202608/9812739182 or Cheque #123456"
              value={recordForm.transactionReference}
              onChange={(e) => setRecordForm({ ...recordForm, transactionReference: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              placeholder="Remarks regarding this payment verification"
              value={recordForm.notes}
              onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px] leading-relaxed">
            <span className="font-bold block">Automatic Receipt Generation:</span>
            Submitting this payment will mark the bill as <strong>PAID</strong> and automatically issue a numbered printable receipt.
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setRecordModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSaving ? 'Processing...' : 'Confirm & Generate Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT BILL BREAKDOWN MODAL */}
      <Modal
        isOpen={editBillModalOpen}
        onClose={() => setEditBillModalOpen(false)}
        title={`Edit Bill: ${selectedPaymentForEdit?.resident?.fullName}`}
        subtitle={`Room ${selectedPaymentForEdit?.room?.roomNumber} • ${selectedPaymentForEdit?.billingMonth}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditBillSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Room Rent (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={editForm.rentAmount}
                onChange={(e) => setEditForm({ ...editForm, rentAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Maintenance Charge (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                value={editForm.maintenanceAmount}
                onChange={(e) => setEditForm({ ...editForm, maintenanceAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Late Fee Penalty (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                value={editForm.penaltyAmount}
                onChange={(e) => setEditForm({ ...editForm, penaltyAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Discount / Waiver (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                value={editForm.discountAmount}
                onChange={(e) => setEditForm({ ...editForm, discountAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Due Date</label>
            <input
              type="date"
              required
              value={editForm.dueDate}
              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Extended due date, waived late fee."
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 flex justify-between font-bold">
            <span>Computed Total Due:</span>
            <span className="text-brand-400 text-sm">
              ₹{Math.max(0, editForm.rentAmount + editForm.maintenanceAmount + editForm.penaltyAmount - editForm.discountAmount).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditBillModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Save Bill Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHANGE STATUS MODAL */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Update Status: ${selectedPaymentForStatus?.resident?.fullName}`}
        subtitle={`Room ${selectedPaymentForStatus?.room?.roomNumber} • ${selectedPaymentForStatus?.billingMonth}`}
        maxWidth="md"
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">Target Status</label>
            <select
              value={statusForm.status}
              onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="PENDING">PENDING (Unpaid)</option>
              <option value="SUBMITTED">SUBMITTED (Pending Admin Review)</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="REJECTED">REJECTED (Invalid Transfer / Slip)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Remarks / Reason</label>
            <textarea
              rows={3}
              placeholder="e.g. UTR not matching statement, or payment verified in bank."
              value={statusForm.notes}
              onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Save Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* GENERATE MONTHLY DUES MODAL */}
      <Modal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Batch Generate Monthly Dues"
        subtitle="Create monthly rental bills for all currently active hostel residents."
        maxWidth="md"
      >
        <form onSubmit={handleGenerateDues} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">Select Billing Month (YYYY-MM)</label>
            <input
              type="month"
              required
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 text-xs font-semibold"
            />
          </div>

          <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
            This will calculate dues for all active residents using their room&apos;s configured rent + standard maintenance. Residents who already have a bill for this month will be skipped to avoid duplicate charges.
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSaving ? 'Generating...' : 'Generate Monthly Bills'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

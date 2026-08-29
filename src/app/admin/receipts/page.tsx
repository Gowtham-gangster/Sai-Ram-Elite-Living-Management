'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  ExternalLink,
  CreditCard,
  Building,
  Calendar,
  Sparkles,
  CheckCircle2,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  DollarSign,
  QrCode,
  MapPin,
  Check,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';
import { formatDate } from '@/lib/dateUtils';

export default function AdminReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [rooms, setRooms] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [hostelSettings, setHostelSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filters & Sorting
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [residentFilter, setResidentFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'receiptAsc' | 'nameAsc' | 'roomAsc'>('dateDesc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [receiptsRes, roomsRes, residentsRes, settingsRes] = await Promise.all([
        fetch('/api/receipts'),
        fetch('/api/rooms'),
        fetch('/api/residents'),
        fetch('/api/settings'),
      ]);

      const dataReceipts = await receiptsRes.json();
      const dataRooms = await roomsRes.json();
      const dataResidents = await residentsRes.json();
      const dataSettings = await settingsRes.json();

      if (dataReceipts.receipts) {
        setReceipts(dataReceipts.receipts);
        setSummary(dataReceipts.summary || {});
      }
      if (dataRooms.rooms) setRooms(dataRooms.rooms);
      if (dataResidents.residents) setResidents(dataResidents.residents);
      if (dataSettings.settings) setHostelSettings(dataSettings.settings);
    } catch (err) {
      console.error('Failed to load receipts data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Available unique billing months for filter
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(receipts.map((r) => r.billingMonth))).sort().reverse();
    if (!months.includes('2026-08')) months.push('2026-08');
    if (!months.includes('2026-09')) months.push('2026-09');
    return months;
  }, [receipts]);

  // Filtered & Sorted Receipts
  const processedReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        // Search
        if (search) {
          const q = search.toLowerCase();
          const matchReceipt = r.receiptNumber?.toLowerCase().includes(q);
          const matchName = r.residentName?.toLowerCase().includes(q);
          const matchRoom = r.roomNumber?.toLowerCase().includes(q);
          const matchNotes = r.notes?.toLowerCase().includes(q);
          const matchRef = r.monthlyPayment?.transactionReference?.toLowerCase().includes(q);
          if (!matchReceipt && !matchName && !matchRoom && !matchNotes && !matchRef) return false;
        }

        // Month
        if (selectedMonth !== 'ALL' && r.billingMonth !== selectedMonth) return false;

        // Room
        if (roomFilter !== 'ALL' && r.monthlyPayment?.roomId !== roomFilter) return false;

        // Resident
        if (residentFilter !== 'ALL' && r.residentId !== residentFilter && r.monthlyPayment?.residentId !== residentFilter) return false;

        // Method
        if (methodFilter !== 'ALL' && r.paymentMethod !== methodFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'dateDesc') return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
        if (sortBy === 'dateAsc') return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
        if (sortBy === 'amountDesc') return b.amountPaid - a.amountPaid;
        if (sortBy === 'amountAsc') return a.amountPaid - b.amountPaid;
        if (sortBy === 'receiptAsc') return a.receiptNumber.localeCompare(b.receiptNumber);
        if (sortBy === 'nameAsc') return a.residentName.localeCompare(b.residentName);
        if (sortBy === 'roomAsc') return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
        return 0;
      });
  }, [receipts, search, selectedMonth, roomFilter, residentFilter, methodFilter, sortBy]);

  // Pagination slice
  const totalPages = Math.ceil(processedReceipts.length / pageSize) || 1;
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedReceipts.slice(start, start + pageSize);
  }, [processedReceipts, currentPage, pageSize]);

  const handleOpenReceipt = (receipt: any) => {
    setSelectedReceipt(receipt);
    setReceiptModalOpen(true);
  };

  const handlePrintModal = () => {
    if (!selectedReceipt) return;
    const printWindow = window.open(`/admin/receipts/${selectedReceipt.receiptNumber}`, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Receipt Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold flex items-center gap-1">
              <Receipt className="w-3 h-3 text-amber-400" />
              <span>Official Tax Invoices & Receipts</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Search, view, print, and export official numbered payment receipts for confirmed resident transactions.
          </p>
        </div>

        <Link
          href="/admin/payments"
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors shrink-0"
        >
          <CreditCard className="w-4 h-4 text-brand-400" />
          <span>Go to Payment Ledger</span>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Receipts Issued</p>
          <p className="text-xl sm:text-2xl font-black text-white mt-1">
            {summary.totalReceiptsCount || receipts.length}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Permanent verified records</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value Documented</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            ₹{(summary.totalCollectedAmount || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">All time verified collections</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 sm:col-span-1 col-span-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Historical Preservation</p>
          <p className="text-xl sm:text-2xl font-black text-brand-400 mt-1">100% Retained</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Includes vacated/checked-out residents</p>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search receipt #, resident name, room #, UTR..."
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

          {/* Room Filter */}
          <div>
            <select
              value={roomFilter}
              onChange={(e) => {
                setRoomFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber}
                </option>
              ))}
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
              <option value="UPI">UPI</option>
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
              <option value="dateDesc">Date: Newest First</option>
              <option value="dateAsc">Date: Oldest First</option>
              <option value="amountDesc">Amount: High to Low</option>
              <option value="amountAsc">Amount: Low to High</option>
              <option value="receiptAsc">Receipt Number</option>
              <option value="nameAsc">Resident Name</option>
              <option value="roomAsc">Room Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Receipts Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading receipt records...</p>
          </div>
        ) : processedReceipts.length === 0 ? (
          <div className="p-16 text-center">
            <Receipt className="w-14 h-14 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No receipts found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Receipts are automatically generated when payments are marked as Paid in the Payment Management module.
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Receipt #</th>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room</th>
                    <th className="py-3.5 px-4 font-bold">Billing Month</th>
                    <th className="py-3.5 px-4 font-bold">Amount Paid</th>
                    <th className="py-3.5 px-4 font-bold">Payment Mode</th>
                    <th className="py-3.5 px-4 font-bold">Payment Date</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Receipt # */}
                      <td className="py-4 px-4 font-mono font-black text-brand-400 text-xs">
                        <button
                          onClick={() => handleOpenReceipt(r)}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{r.receiptNumber}</span>
                        </button>
                      </td>

                      {/* Resident */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-white text-sm">{r.residentName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {r.monthlyPayment?.resident?.phone || 'Verified Resident'}
                        </div>
                      </td>

                      {/* Room */}
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-slate-200">
                          Room {r.roomNumber}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          Floor {r.monthlyPayment?.room?.floor || 1}
                        </div>
                      </td>

                      {/* Billing Month */}
                      <td className="py-4 px-4 font-medium text-slate-300">
                        {r.billingMonth}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-4 px-4">
                        <span className="font-black text-white text-sm">
                          ₹{r.amountPaid.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 ml-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          PAID
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-4 px-4 text-slate-300 font-semibold">
                        {r.paymentMethod}
                      </td>

                      {/* Payment Date */}
                      <td className="py-4 px-4 text-slate-400">
                        {formatDate(r.paymentDate)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick View Modal */}
                          <button
                            onClick={() => handleOpenReceipt(r)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Preview Receipt"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print / Dedicated View */}
                          <Link
                            href={`/admin/receipts/${r.receiptNumber}`}
                            target="_blank"
                            className="p-1.5 text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors"
                            title="Print Receipt / Export PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>
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
                  {Math.min(currentPage * pageSize, processedReceipts.length)}
                </strong>{' '}
                of <strong className="text-white">{processedReceipts.length}</strong> official receipts
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

      {/* VIEW RECEIPT PREVIEW MODAL */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title={`Official Receipt: ${selectedReceipt?.receiptNumber}`}
        subtitle={`Issued to ${selectedReceipt?.residentName} • Room ${selectedReceipt?.roomNumber}`}
        maxWidth="lg"
      >
        {selectedReceipt && (
          <div className="space-y-6 text-xs">
            {/* Printable Receipt Card Body */}
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-6 text-slate-300">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                    <img src="/logo.png" alt="Hostel Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {hostelSettings?.hostelName || 'SAIRAM ELITE LIVING'}
                    </h3>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                      PG & Boys Hostel
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">
                      {hostelSettings?.hostelAddress ||
                        'Plot No. 57, Near Pragati Model High School, Beside Vibhu Park Apartment, Gandi Maisamma, Hyderabad, Telangana – 500043'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Phone: {hostelSettings?.contactPhone || '+91 8977339133, 918688535143'} • Email: {hostelSettings?.contactEmail || 'sairameliteliving@gmail.com'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-black text-xs inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>PAID & VERIFIED</span>
                  </span>
                  <div className="font-mono font-black text-brand-400 text-sm mt-2">
                    {selectedReceipt.receiptNumber}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Date: {formatDate(selectedReceipt.paymentDate)}
                  </div>
                </div>
              </div>

              {/* Resident & Room Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Resident Name</span>
                  <span className="font-extrabold text-white text-sm block mt-0.5">
                    {selectedReceipt.residentName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Phone: {selectedReceipt.monthlyPayment?.resident?.phone || 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Room Allocation</span>
                  <span className="font-mono font-black text-brand-400 text-sm block mt-0.5">
                    Room {selectedReceipt.roomNumber}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Floor {selectedReceipt.monthlyPayment?.room?.floor || 1}
                  </span>
                </div>
              </div>

              {/* Breakdown Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Billing Cycle</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/30 text-slate-200">
                    <tr>
                      <td className="py-3 px-3">
                        <strong className="text-white">Hostel Room Accommodation & Maintenance</strong>
                        <div className="text-[10px] text-slate-400">
                          Payment Mode: {selectedReceipt.paymentMethod}
                          {selectedReceipt.monthlyPayment?.transactionReference && ` • Ref: ${selectedReceipt.monthlyPayment.transactionReference}`}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold">{selectedReceipt.billingMonth}</td>
                      <td className="py-3 px-3 text-right font-black text-white text-sm">
                        ₹{selectedReceipt.amountPaid.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-950 border-t border-slate-800 text-white font-bold">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-right uppercase text-[11px] text-slate-400">
                        Total Amount Received:
                      </td>
                      <td className="py-3 px-3 text-right text-base font-black text-brand-400">
                        ₹{selectedReceipt.amountPaid.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatory & Confirmation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-[10px] text-slate-500">
                <div>
                  <span>Issued By: <strong>{selectedReceipt.generatedBy || 'Hostel Administrator'}</strong></span>
                  <p className="mt-0.5">This is a system-generated electronic receipt.</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-slate-400">SAIRAM ELITE LIVING</span>
                </div>
              </div>
            </div>

            {/* Modal Action Controls */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href={`/admin/receipts/${selectedReceipt.receiptNumber}`}
                target="_blank"
                className="text-xs text-brand-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Open in dedicated full-page view</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

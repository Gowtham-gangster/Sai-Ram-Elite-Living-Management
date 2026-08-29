'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  Download,
  Calendar,
  CreditCard,
  Building,
  User,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalReceiptsCount: 0, totalCollectedAmount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (!res.ok) throw new Error('Unable to load payment receipts.');
      const data = await res.json();
      setReceipts(data.receipts || []);
      setSummary(data.summary || { totalReceiptsCount: 0, totalCollectedAmount: 0 });
    } catch (err: any) {
      setError(err.message || 'Error fetching receipts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Payment Receipts
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              Verified Invoices
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official rent payment receipts, verified payment records, and tax vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReceipts}
            className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Receipts Issued</div>
          <div className="text-3xl font-black text-white mt-1">
            {isLoading ? <div className="h-9 w-20 bg-slate-800 rounded-lg animate-pulse mt-1" /> : summary.totalReceiptsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Official numbered invoices generated</div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Collections Verified</div>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            {isLoading ? <div className="h-9 w-28 bg-slate-800 rounded-lg animate-pulse mt-1" /> : formatCurrency(summary.totalCollectedAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across all verified receipt payments</div>
        </div>
      </div>

      {/* Receipts List */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white">Receipts Ledger</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchReceipts();
            }}
            className="relative w-full sm:w-64"
          >
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by receipt or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
            />
          </form>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Loading receipt vouchers...</span>
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-300">No receipts available yet</h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Receipts will be generated automatically when resident monthly payments are recorded and verified.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Receipt Number</th>
                  <th className="p-3">Resident</th>
                  <th className="p-3">Room</th>
                  <th className="p-3">Billing Month</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {receipts.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-800/20">
                    <td className="p-3 font-mono font-bold text-amber-400">{r.receiptNumber}</td>
                    <td className="p-3 font-bold text-white">{r.residentName}</td>
                    <td className="p-3">Room {r.roomNumber}</td>
                    <td className="p-3">{r.billingMonth}</td>
                    <td className="p-3 font-bold text-emerald-400">{formatCurrency(r.amountPaid)}</td>
                    <td className="p-3">{formatDate(r.paymentDate)}</td>
                    <td className="p-3">{r.paymentMethod || 'UPI'}</td>
                    <td className="p-3 text-right">
                      <a
                        href={`/api/pay/receipt/${r.downloadToken || r.receiptNumber}`}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                        title="Download official PDF receipt"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download PDF</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

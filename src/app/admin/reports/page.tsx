'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Filter,
  Users,
  Building,
  CreditCard,
  AlertTriangle,
  Receipt,
  UserX,
  TrendingUp,
  Clock,
  Sparkles,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpDown,
  FileText,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';

type ReportTab =
  | 'RESIDENT'
  | 'OCCUPANCY'
  | 'MONTHLY_PAYMENTS'
  | 'PENDING'
  | 'OVERDUE'
  | 'COLLECTIONS'
  | 'CHECKOUT';

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('RESIDENT');
  const [reportsData, setReportsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedRoom, setSelectedRoom] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReportsData(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const summary = reportsData?.summary || {};
  const reports = reportsData?.reports || {};

  // Active Report Raw List
  const rawList: any[] = useMemo(() => {
    if (!reports) return [];
    switch (activeTab) {
      case 'RESIDENT':
        return reports.residentReport || [];
      case 'OCCUPANCY':
        return reports.roomOccupancyReport || [];
      case 'MONTHLY_PAYMENTS':
        return reports.monthlyPaymentReport || [];
      case 'PENDING':
        return reports.pendingPaymentReport || [];
      case 'OVERDUE':
        return reports.overduePaymentReport || [];
      case 'COLLECTIONS':
        return reports.collectionReport || [];
      case 'CHECKOUT':
        return reports.checkoutReport || [];
      default:
        return [];
    }
  }, [reports, activeTab]);

  // Unique Months for Filter
  const availableMonths: string[] = useMemo(() => {
    if (!reports.monthlyPaymentReport) return ['2026-08', '2026-09'];
    const months = Array.from(new Set<string>(reports.monthlyPaymentReport.map((p: any) => String(p.billingMonth)))).sort().reverse();
    return months;
  }, [reports]);

  // Unique Rooms for Filter
  const availableRooms: string[] = useMemo(() => {
    if (!reports.roomOccupancyReport) return [];
    return reports.roomOccupancyReport.map((r: any) => String(r.roomNumber));
  }, [reports]);

  // Filtered List
  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const str = JSON.stringify(item).toLowerCase();
        if (!str.includes(q)) return false;
      }

      // Month
      if (selectedMonth !== 'ALL' && item.billingMonth && item.billingMonth !== selectedMonth) {
        return false;
      }

      // Room
      if (selectedRoom !== 'ALL' && item.roomNumber && String(item.roomNumber) !== String(selectedRoom)) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && item.status && item.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [rawList, search, selectedMonth, selectedRoom, statusFilter]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Export to CSV / Excel
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;

    const headers = Object.keys(filteredList[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of filteredList) {
      const values = headers.map((header) => {
        const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SAIRAM_${activeTab}_REPORT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Compiling management reports & analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Reports & Financial Analytics</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-amber-400" />
              <span>Real-Time Database Queries</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive census reports across resident census, room capacity utilization, collections, and checkouts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV / Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hostel Occupancy</p>
          <p className="text-xl sm:text-2xl font-black text-brand-400 mt-1">
            {summary.occupancyPercentage}%
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {summary.totalActiveResidents} active / {summary.totalCapacity} total slots
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue Collected</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            ₹{(summary.totalCollectedAllTime || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{summary.totalReceiptsIssued} receipts generated</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Dues</p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
            ₹{(summary.totalPendingCurrent || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Unpaid / in review</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue Dues</p>
          <p className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
            ₹{(summary.totalOverdueCurrent || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Past due date</p>
        </div>
      </div>

      {/* Reports Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl print:hidden">
        <button
          onClick={() => {
            setActiveTab('RESIDENT');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'RESIDENT'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>1. Resident Census</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('OCCUPANCY');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'OCCUPANCY'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>2. Room Occupancy</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('MONTHLY_PAYMENTS');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'MONTHLY_PAYMENTS'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>3. Monthly Payments</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('PENDING');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PENDING'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>4. Pending Dues</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('OVERDUE');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'OVERDUE'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>5. Overdue Accounts</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('COLLECTIONS');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'COLLECTIONS'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>6. Collections</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('CHECKOUT');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'CHECKOUT'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>7. Checkouts & Vacated</span>
        </button>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, room #, phone..."
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
              <option value="ALL">All Billing Months</option>
              {availableMonths.map((m: string) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <select
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Rooms</option>
              {availableRooms.map((r: string) => (
                <option key={r} value={r}>
                  Room {r}
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
              <option value="ACTIVE">ACTIVE</option>
              <option value="NOTICE_PERIOD">NOTICE PERIOD</option>
              <option value="VACATED">VACATED</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden bg-slate-950/40 print:bg-white print:text-black print:border-none">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between print:p-0 print:border-b-2 print:border-black print:pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider print:text-black">
              {activeTab.replace('_', ' ')} REPORT
            </h3>
            <p className="text-[11px] text-slate-400 print:text-slate-600">
              Showing {filteredList.length} documented records
            </p>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            No matching records found for the selected filter criteria.
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                {/* 1. RESIDENT REPORT HEADERS */}
                {activeTab === 'RESIDENT' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Resident</th>
                        <th className="py-3 px-3">Contact</th>
                        <th className="py-3 px-3">Room</th>
                        <th className="py-3 px-3">Sharing</th>
                        <th className="py-3 px-3">Monthly Rent</th>
                        <th className="py-3 px-3">Check-in Date</th>
                        <th className="py-3 px-3">Emergency Contact</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((r: any) => (
                        <tr key={r.residentId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white print:text-black">{r.fullName}</td>
                          <td className="py-3 px-3 text-slate-400">{r.phone}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 print:text-black">Room {r.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-300">{r.sharingType}</td>
                          <td className="py-3 px-3 font-extrabold text-white print:text-black">₹{r.agreedMonthlyRent.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(r.checkInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-3 text-slate-300">{r.emergencyContactName} ({r.emergencyContactPhone})</td>
                          <td className="py-3 px-3"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 2. OCCUPANCY REPORT HEADERS */}
                {activeTab === 'OCCUPANCY' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Room #</th>
                        <th className="py-3 px-3">Floor</th>
                        <th className="py-3 px-3">Sharing</th>
                        <th className="py-3 px-3">Capacity</th>
                        <th className="py-3 px-3">Occupied</th>
                        <th className="py-3 px-3">Available</th>
                        <th className="py-3 px-3">Occupancy Rate</th>
                        <th className="py-3 px-3">Current Revenue</th>
                        <th className="py-3 px-3">Assigned Residents</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((rm: any) => (
                        <tr key={rm.roomId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-mono font-black text-brand-400 print:text-black">Room {rm.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-300">Floor {rm.floor}</td>
                          <td className="py-3 px-3 text-slate-300">{rm.sharingType}</td>
                          <td className="py-3 px-3 font-bold">{rm.capacity}</td>
                          <td className="py-3 px-3 font-bold text-emerald-400 print:text-black">{rm.activeResidentsCount}</td>
                          <td className="py-3 px-3 font-bold text-amber-400 print:text-black">{rm.availableSlots}</td>
                          <td className="py-3 px-3 font-extrabold text-white print:text-black">{rm.occupancyRatePercentage}%</td>
                          <td className="py-3 px-3 font-black text-white print:text-black">₹{rm.currentRealizedRevenue.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">{rm.residents}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 3. MONTHLY PAYMENTS REPORT */}
                {activeTab === 'MONTHLY_PAYMENTS' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Resident</th>
                        <th className="py-3 px-3">Room</th>
                        <th className="py-3 px-3">Billing Month</th>
                        <th className="py-3 px-3">Rent</th>
                        <th className="py-3 px-3">Maint / Penalty</th>
                        <th className="py-3 px-3">Total Due</th>
                        <th className="py-3 px-3">Due Date</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Receipt / Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((p: any) => (
                        <tr key={p.paymentId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white print:text-black">{p.residentName}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 print:text-black">Room {p.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-300">{p.billingMonth}</td>
                          <td className="py-3 px-3 text-slate-300">₹{p.rentAmount}</td>
                          <td className="py-3 px-3 text-slate-400">+₹{p.maintenanceAmount || 0} / +₹{p.penaltyAmount || 0}</td>
                          <td className="py-3 px-3 font-black text-white print:text-black">₹{p.totalAmountDue.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-slate-400">{new Date(p.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                          <td className="py-3 px-3 text-slate-400">{p.receiptNumber !== 'N/A' ? p.receiptNumber : p.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 4. PENDING DUES REPORT */}
                {activeTab === 'PENDING' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Resident</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3">Room</th>
                        <th className="py-3 px-3">Billing Month</th>
                        <th className="py-3 px-3">Amount Due</th>
                        <th className="py-3 px-3">Due Date</th>
                        <th className="py-3 px-3">Days Pending</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((p: any) => (
                        <tr key={p.paymentId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white print:text-black">{p.residentName}</td>
                          <td className="py-3 px-3 text-slate-400">{p.phone}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 print:text-black">Room {p.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-300">{p.billingMonth}</td>
                          <td className="py-3 px-3 font-black text-amber-400 print:text-black">₹{p.amountDue.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-slate-400">{new Date(p.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="py-3 px-3 font-bold text-slate-300">{p.daysPending} days</td>
                          <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 5. OVERDUE REPORT */}
                {activeTab === 'OVERDUE' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Resident</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3">Room</th>
                        <th className="py-3 px-3">Billing Month</th>
                        <th className="py-3 px-3">Overdue Amount</th>
                        <th className="py-3 px-3">Due Date</th>
                        <th className="py-3 px-3">Days Overdue</th>
                        <th className="py-3 px-3">Est. Late Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((p: any) => (
                        <tr key={p.paymentId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white print:text-black">{p.residentName}</td>
                          <td className="py-3 px-3 text-slate-400">{p.phone}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 print:text-black">Room {p.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-300">{p.billingMonth}</td>
                          <td className="py-3 px-3 font-black text-rose-400 print:text-black">₹{p.amountDue.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-slate-400">{new Date(p.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td className="py-3 px-3 font-bold text-rose-400 print:text-black">{p.daysOverdue} days</td>
                          <td className="py-3 px-3 font-bold text-amber-400 print:text-black">+₹{p.estimatedLateFee.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 6. COLLECTIONS REPORT */}
                {activeTab === 'COLLECTIONS' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Receipt #</th>
                        <th className="py-3 px-3">Resident</th>
                        <th className="py-3 px-3">Room</th>
                        <th className="py-3 px-3">Billing Month</th>
                        <th className="py-3 px-3">Amount Collected</th>
                        <th className="py-3 px-3">Payment Mode</th>
                        <th className="py-3 px-3">Payment Date</th>
                        <th className="py-3 px-3">Verified By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((rc: any) => (
                        <tr key={rc.receiptId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 print:text-black">{rc.receiptNumber}</td>
                          <td className="py-3 px-3 font-bold text-white print:text-black">{rc.residentName}</td>
                          <td className="py-3 px-3 font-mono text-slate-300">Room {rc.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-300">{rc.billingMonth}</td>
                          <td className="py-3 px-3 font-black text-emerald-400 print:text-black">₹{rc.amountPaid.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-slate-300 font-semibold">{rc.paymentMethod}</td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(rc.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-3 text-slate-400">{rc.generatedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 7. CHECKOUTS REPORT */}
                {activeTab === 'CHECKOUT' && (
                  <>
                    <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-3 px-3">Resident</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3">Room</th>
                        <th className="py-3 px-3">Check-in Date</th>
                        <th className="py-3 px-3">Check-out Date</th>
                        <th className="py-3 px-3">Tenancy Duration</th>
                        <th className="py-3 px-3">Security Deposit</th>
                        <th className="py-3 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                      {paginatedList.map((ck: any) => (
                        <tr key={ck.residentId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white print:text-black">{ck.fullName}</td>
                          <td className="py-3 px-3 text-slate-400">{ck.phone}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 print:text-black">Room {ck.roomNumber}</td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(ck.checkInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {ck.checkOutDate ? new Date(ck.checkOutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="py-3 px-3 font-bold text-white print:text-black">{ck.stayDurationDays} days</td>
                          <td className="py-3 px-3 text-slate-300">{ck.securityDeposit ? String(ck.securityDeposit) : 'N/A'}</td>
                          <td className="py-3 px-3 text-slate-400">{ck.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs print:hidden">
              <div className="text-slate-400">
                Showing{' '}
                <strong className="text-white">
                  {(currentPage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-white">
                  {Math.min(currentPage * pageSize, filteredList.length)}
                </strong>{' '}
                of <strong className="text-white">{filteredList.length}</strong> items
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
    </div>
  );
}

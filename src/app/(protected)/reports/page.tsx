'use client';

import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Users,
  DoorOpen,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  TrendingUp,
  AlertCircle,
  Building,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/Badge';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'RESIDENTS' | 'ROOMS' | 'PAYMENTS' | 'COLLECTIONS' | 'CHECKOUTS'>('RESIDENTS');

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Unable to compile management reports.');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const summary = data?.summary || {
    totalRooms: 0,
    totalCapacity: 0,
    totalActiveResidents: 0,
    occupancyPercentage: 0,
    totalBilledAllTime: 0,
    totalCollectedAllTime: 0,
    totalPendingCurrent: 0,
    totalOverdueCurrent: 0,
    totalCheckedOut: 0,
    totalReceiptsIssued: 0,
  };

  const reports = data?.reports || {};
  const residentReport = reports.residentReport || [];
  const roomOccupancyReport = reports.roomOccupancyReport || [];
  const monthlyPaymentReport = reports.monthlyPaymentReport || [];
  const collectionReport = reports.collectionReport || [];
  const checkoutReport = reports.checkoutReport || [];

  /**
   * Generates a real Microsoft Excel Workbook (.xlsx) with structured columns and data types
   */
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      const todayStr = new Date().toISOString().slice(0, 10);
      let sheetName = 'Report';
      let filename = `SAIRAM_ELITE_LIVING_Report_${todayStr}.xlsx`;
      let exportRows: any[] = [];

      if (activeTab === 'RESIDENTS') {
        sheetName = 'Resident Census';
        filename = `SAIRAM_ELITE_LIVING_Resident_Census_${todayStr}.xlsx`;
        exportRows = residentReport.map((r: any) => ({
          'Resident Name': r.fullName,
          'Room Number': String(r.roomNumber),
          'Floor': Number(r.floor),
          'Sharing Type': r.sharingType,
          'Phone Number': String(r.phone),
          'Alternate Phone': r.alternatePhone || 'N/A',
          'Email': r.email || 'N/A',
          'Agreed Monthly Rent (₹)': Number(r.agreedMonthlyRent),
          'Security Deposit': r.securityDeposit ? String(r.securityDeposit) : 'N/A',
          'Check-in Date': r.checkInDate ? new Date(r.checkInDate).toISOString().slice(0, 10) : 'N/A',
          'Expected Checkout Date': r.expectedCheckoutDate ? new Date(r.expectedCheckoutDate).toISOString().slice(0, 10) : 'N/A',
          'ID Proof Type': r.idProofType,
          'ID Proof Number (Masked)': r.idProofNumber,
          'Emergency Contact Name': r.emergencyContactName,
          'Emergency Contact Phone': String(r.emergencyContactPhone || 'N/A'),
          'Status': r.status,
        }));
      } else if (activeTab === 'ROOMS') {
        sheetName = 'Room Occupancy';
        filename = `SAIRAM_ELITE_LIVING_Room_Occupancy_${todayStr}.xlsx`;
        exportRows = roomOccupancyReport.map((rm: any) => ({
          'Room Number': String(rm.roomNumber),
          'Floor': Number(rm.floor),
          'Sharing Type': rm.sharingType,
          'Total Capacity': Number(rm.capacity),
          'Active Residents': Number(rm.activeResidentsCount),
          'Available Spaces': Number(rm.availableSlots),
          'Occupancy Rate (%)': Number(rm.occupancyRatePercentage),
          'Monthly Collection (₹)': Number(rm.currentRealizedRevenue),
          'Status': rm.status,
          'Assigned Residents': rm.residents,
        }));
      } else if (activeTab === 'PAYMENTS') {
        sheetName = 'Payment Ledgers';
        filename = `SAIRAM_ELITE_LIVING_Payment_Ledgers_${todayStr}.xlsx`;
        exportRows = monthlyPaymentReport.map((p: any) => ({
          'Resident Name': p.residentName,
          'Phone Number': String(p.phone),
          'Room Number': String(p.roomNumber),
          'Floor': Number(p.floor),
          'Billing Month': p.billingMonth,
          'Base Rent (₹)': Number(p.rentAmount),
          'Maintenance (₹)': Number(p.maintenanceAmount || 0),
          'Late Penalty (₹)': Number(p.penaltyAmount || 0),
          'Discount (₹)': Number(p.discountAmount || 0),
          'Total Due (₹)': Number(p.totalAmountDue),
          'Due Date': p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : 'N/A',
          'Paid Date': p.paidDate ? new Date(p.paidDate).toISOString().slice(0, 10) : 'N/A',
          'Status': p.status,
          'Payment Method': p.paymentMethod,
          'Receipt Number': p.receiptNumber,
          'Transaction Reference': p.transactionReference,
        }));
      } else if (activeTab === 'COLLECTIONS') {
        sheetName = 'Collections & Receipts';
        filename = `SAIRAM_ELITE_LIVING_Collections_Receipts_${todayStr}.xlsx`;
        exportRows = collectionReport.map((rc: any) => ({
          'Receipt Number': rc.receiptNumber,
          'Resident Name': rc.residentName,
          'Room Number': String(rc.roomNumber),
          'Billing Month': rc.billingMonth,
          'Amount Paid (₹)': Number(rc.amountPaid),
          'Payment Date': rc.paymentDate ? new Date(rc.paymentDate).toISOString().slice(0, 10) : 'N/A',
          'Payment Method': rc.paymentMethod,
          'Generated By': rc.generatedBy,
          'Notes': rc.notes,
        }));
      } else if (activeTab === 'CHECKOUTS') {
        sheetName = 'Checkout History';
        filename = `SAIRAM_ELITE_LIVING_Checkout_History_${todayStr}.xlsx`;
        exportRows = checkoutReport.map((c: any) => ({
          'Resident Name': c.fullName,
          'Phone Number': String(c.phone),
          'Room Number': String(c.roomNumber),
          'Floor': Number(c.floor),
          'Check-in Date': c.checkInDate ? new Date(c.checkInDate).toISOString().slice(0, 10) : 'N/A',
          'Checkout Date': c.checkOutDate ? new Date(c.checkOutDate).toISOString().slice(0, 10) : 'N/A',
          'Stay Duration (Days)': Number(c.stayDurationDays),
          'Security Deposit': c.securityDeposit ? String(c.securityDeposit) : 'N/A',
          'Status': c.status,
          'Notes': c.notes,
        }));
      }

      // Handle Empty Dataset Gracefully
      if (exportRows.length === 0) {
        exportRows = [{ 'Status': 'No records found for the selected report criteria' }];
      }

      // Create Worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      // Auto-fit Column Widths
      const colKeys = Object.keys(exportRows[0]);
      const colWidths = colKeys.map((key) => {
        const maxLen = Math.max(
          key.length,
          ...exportRows.map((r) => String(r[key] ?? '').length)
        );
        return { wch: Math.min(40, Math.max(12, maxLen + 2)) };
      });
      worksheet['!cols'] = colWidths;

      // Create Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Write and trigger download (.xlsx)
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx', type: 'binary' });
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      setExportError(err.message || 'Failed to generate Excel workbook.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Reports & Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              Executive Census
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time occupancy tracking, financial census, collections, and resident census reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReports}
            className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Export Error Alert */}
      {exportError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Census</div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {isLoading ? <div className="h-8 w-16 bg-slate-800 rounded-lg animate-pulse mt-1" /> : summary.totalActiveResidents}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isLoading ? <div className="h-4 w-28 bg-slate-800/80 rounded-md animate-pulse mt-1" /> : `${summary.occupancyPercentage}% of ${summary.totalCapacity} capacity`}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Rooms</div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400 mt-1">
            {isLoading ? <div className="h-8 w-16 bg-slate-800 rounded-lg animate-pulse mt-1" /> : summary.totalRooms}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isLoading ? <div className="h-4 w-32 bg-slate-800/80 rounded-md animate-pulse mt-1" /> : `${summary.totalCapacity} maximum resident slots`}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Collections</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
            {isLoading ? <div className="h-8 w-24 bg-slate-800 rounded-lg animate-pulse mt-1" /> : formatCurrency(summary.totalCollectedAllTime)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isLoading ? <div className="h-4 w-28 bg-slate-800/80 rounded-md animate-pulse mt-1" /> : `${summary.totalReceiptsIssued} receipts generated`}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Outstanding Dues</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
            {isLoading ? <div className="h-8 w-24 bg-slate-800 rounded-lg animate-pulse mt-1" /> : formatCurrency(summary.totalPendingCurrent + summary.totalOverdueCurrent)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across pending & overdue bills
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'RESIDENTS', label: 'Resident Census', count: residentReport.length, icon: Users },
          { id: 'ROOMS', label: 'Room Occupancy', count: roomOccupancyReport.length, icon: DoorOpen },
          { id: 'PAYMENTS', label: 'Payment Ledgers', count: monthlyPaymentReport.length, icon: CreditCard },
          { id: 'COLLECTIONS', label: 'Receipts / Collections', count: collectionReport.length, icon: Receipt },
          { id: 'CHECKOUTS', label: 'Vacated / Checkouts', count: checkoutReport.length, icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              {activeTab === 'RESIDENTS' && 'Resident Census Report'}
              {activeTab === 'ROOMS' && 'Room Occupancy & Capacity Report'}
              {activeTab === 'PAYMENTS' && 'Monthly Rent & Payment Ledger Report'}
              {activeTab === 'COLLECTIONS' && 'Revenue & Receipt Collection Report'}
              {activeTab === 'CHECKOUTS' && 'Vacated & Checkout History Report'}
            </h2>
            <p className="text-[11px] text-slate-400">Exportable executive dataset</p>
          </div>

          {/* Primary Export Button: Microsoft Excel Workbook (.xlsx) */}
          <button
            type="button"
            onClick={exportToExcel}
            disabled={isExporting}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 self-start"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generating Excel...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <span>Compiling report analytics...</span>
          </div>
        ) : (
          <>
            {/* Tab 1: Resident Census */}
            {activeTab === 'RESIDENTS' && (
          <div>
            {residentReport.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-xs font-bold text-slate-300">No resident activity yet</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Active residents will appear in this census once Google Form registrations are approved.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Resident Name</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Check-in Date</th>
                      <th className="p-3">Monthly Rent</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {residentReport.map((r: any) => (
                      <tr key={r.residentId} className="hover:bg-slate-800/20">
                        <td className="p-3 font-bold text-white">{r.fullName}</td>
                        <td className="p-3">Room {r.roomNumber} (Floor {r.floor})</td>
                        <td className="p-3 font-mono">{r.phone}</td>
                        <td className="p-3">{formatDate(r.checkInDate)}</td>
                        <td className="p-3 font-bold text-amber-400">{formatCurrency(r.agreedMonthlyRent)}</td>
                        <td className="p-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Room Occupancy */}
        {activeTab === 'ROOMS' && (
          <div>
            {roomOccupancyReport.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <DoorOpen className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-xs font-bold text-slate-300">No rooms configured</h3>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Room Number</th>
                      <th className="p-3">Floor</th>
                      <th className="p-3">Sharing Type</th>
                      <th className="p-3">Capacity</th>
                      <th className="p-3">Occupied</th>
                      <th className="p-3">Occupancy Rate</th>
                      <th className="p-3">Monthly Potential</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {roomOccupancyReport.map((rm: any) => (
                      <tr key={rm.roomId} className="hover:bg-slate-800/20">
                        <td className="p-3 font-bold text-white">Room {rm.roomNumber}</td>
                        <td className="p-3">Floor {rm.floor}</td>
                        <td className="p-3">{rm.sharingType}</td>
                        <td className="p-3">{rm.capacity} residents</td>
                        <td className="p-3 font-semibold text-emerald-400">{rm.activeResidentsCount}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{rm.occupancyRatePercentage}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${rm.occupancyRatePercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-bold text-amber-400">{formatCurrency(rm.potentialMonthlyRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Payments */}
        {activeTab === 'PAYMENTS' && (
          <div>
            {monthlyPaymentReport.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-xs font-bold text-slate-300">No payment records yet</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Payment records will be generated automatically once resident admissions are approved.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Resident</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Billing Month</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {monthlyPaymentReport.map((p: any) => (
                      <tr key={p.paymentId} className="hover:bg-slate-800/20">
                        <td className="p-3 font-bold text-white">{p.residentName}</td>
                        <td className="p-3">Room {p.roomNumber}</td>
                        <td className="p-3">{p.billingMonth}</td>
                        <td className="p-3 font-bold text-white">{formatCurrency(p.totalAmountDue)}</td>
                        <td className="p-3">{formatDate(p.dueDate)}</td>
                        <td className="p-3"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Collections */}
        {activeTab === 'COLLECTIONS' && (
          <div>
            {collectionReport.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-xs font-bold text-slate-300">No receipts issued yet</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Receipts will appear here when resident payments are verified and recorded.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Resident</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Month</th>
                      <th className="p-3">Amount Paid</th>
                      <th className="p-3">Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {collectionReport.map((rc: any) => (
                      <tr key={rc.receiptId} className="hover:bg-slate-800/20">
                        <td className="p-3 font-mono font-bold text-amber-400">{rc.receiptNumber}</td>
                        <td className="p-3 font-bold text-white">{rc.residentName}</td>
                        <td className="p-3">Room {rc.roomNumber}</td>
                        <td className="p-3">{rc.billingMonth}</td>
                        <td className="p-3 font-bold text-emerald-400">{formatCurrency(rc.amountPaid)}</td>
                        <td className="p-3">{formatDate(rc.paymentDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Checkouts */}
        {activeTab === 'CHECKOUTS' && (
          <div>
            {checkoutReport.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Clock className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-xs font-bold text-slate-300">No checkout records</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Historical vacated resident records will be archived here upon checkout completion.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Resident Name</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Stay Duration</th>
                      <th className="p-3">Checkout Date</th>
                      <th className="p-3">Security Deposit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {checkoutReport.map((c: any) => (
                      <tr key={c.residentId} className="hover:bg-slate-800/20">
                        <td className="p-3 font-bold text-white">{c.fullName}</td>
                        <td className="p-3">Room {c.roomNumber}</td>
                        <td className="p-3">{c.stayDurationDays} days</td>
                        <td className="p-3">{formatDate(c.checkOutDate)}</td>
                        <td className="p-3 font-bold text-slate-200">{c.securityDeposit ? String(c.securityDeposit) : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </>
      )}
      </div>
    </div>
  );
}

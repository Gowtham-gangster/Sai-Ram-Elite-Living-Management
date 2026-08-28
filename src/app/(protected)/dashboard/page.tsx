'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  DoorOpen,
  CreditCard,
  Receipt,
  UserPlus,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingUp,
  Building,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { formatCurrency, formatIndianDate } from '@/lib/utils';
import { maskAadhaar } from '@/lib/residentStats';

export default function DashboardPage() {
  const { profile, role } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      setError(null);

      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        throw new Error('Unable to load dashboard data. Please try again.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching dashboard statistics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const metrics = data?.metrics || {
    totalRegistrations: 0,
    pendingRegistrations: 0,
    newRegistrations: 0,
    underReviewRegistrations: 0,
    approvedRegistrations: 0,
    rejectedRegistrations: 0,
    activeResidents: 0,
    newResidentsThisMonth: 0,
    residentsInNoticePeriod: 0,
    totalRooms: 0,
    totalRoomCapacity: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    availableCapacity: 0,
    occupancyPercentage: 0,
    pendingPaymentsCount: 0,
    paidPaymentsCount: 0,
    outstandingAmount: 0,
    totalPaymentsCollected: 0,
    totalReceiptsCount: 0,
    currentBillingMonth: '',
  };

  const registrations = data?.registrations || [];
  const visualizations = data?.visualizations || {};
  const recentResidents = visualizations?.recentResidents || [];
  const recentPayments = visualizations?.recentPayments || [];
  const recentAuditLogs = visualizations?.recentAuditLogs || [];
  const floorBreakdown = visualizations?.floorBreakdown || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse h-36" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-4 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <div>
          <h2 className="text-base font-bold text-rose-300">Unable to load Dashboard</h2>
          <p className="text-xs text-rose-200/80 mt-1">{error}</p>
        </div>
        <button
          onClick={() => fetchDashboardData(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* 1. Welcome & Control Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-amber-950/30 border border-slate-800 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden sm:block">
          <DoorOpen className="w-44 h-44 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Hostel Management System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Welcome back, {profile?.full_name || 'Administrator'}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Overview of Google Form intakes, room capacity, active residents, and monthly billing ledgers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <Link
              href="/registrations"
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrations</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Prominent Pending Approval Alert Banner */}
      {metrics.pendingRegistrations > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-300">
                {metrics.pendingRegistrations} registration{metrics.pendingRegistrations > 1 ? 's' : ''} waiting for approval
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                New Google Form applications require owner review before becoming active residents and occupying room capacity.
              </p>
            </div>
          </div>
          <Link
            href="/registrations"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-md shadow-amber-500/20"
          >
            <span>Review Registrations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 3. Core Statistics Grid (12 Metrics Across 4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 1: Registrations */}
        <Link
          href="/registrations"
          className="p-5 rounded-3xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Registrations</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{metrics.totalRegistrations}</div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-amber-400 font-semibold">{metrics.pendingRegistrations} Pending</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-semibold">{metrics.approvedRegistrations} Approved</span>
            <span className="text-slate-500">•</span>
            <span className="text-rose-400 font-semibold">{metrics.rejectedRegistrations} Rejected</span>
          </div>
        </Link>

        {/* Metric Card 2: Active Residents */}
        <Link
          href="/residents"
          className="p-5 rounded-3xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all group shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Residents</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{metrics.activeResidents}</div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>+{metrics.newResidentsThisMonth} joined this month</span>
            {metrics.residentsInNoticePeriod > 0 && (
              <span className="text-amber-400 font-semibold">{metrics.residentsInNoticePeriod} on notice</span>
            )}
          </div>
        </Link>

        {/* Metric Card 3: Room Occupancy (Zero Beds) */}
        <Link
          href="/rooms"
          className="p-5 rounded-3xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition-all group shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Room Occupancy</span>
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
              <DoorOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{metrics.occupancyPercentage}%</span>
            <span className="text-xs text-slate-400">({metrics.activeResidents} / {metrics.totalRoomCapacity} capacity)</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-300">{metrics.occupiedRooms} occupied rooms</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-semibold">{metrics.availableCapacity} available spots</span>
          </div>
        </Link>

        {/* Metric Card 4: Payments & Dues */}
        <Link
          href="/payments"
          className="p-5 rounded-3xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding Dues</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400">{formatCurrency(metrics.outstandingAmount)}</div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-rose-400 font-semibold">{metrics.pendingPaymentsCount} pending bills</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-semibold">{metrics.paidPaymentsCount} paid</span>
          </div>
        </Link>
      </div>

      {/* 4. Main Two-Column Layout: Registrations Feed + Operations Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Google Form Registrations (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Recent Registrations</h2>
                  <p className="text-[11px] text-slate-400">Incoming applications from Google Forms</p>
                </div>
              </div>
              <Link
                href="/registrations"
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <span>View All Registrations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {registrations.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="max-w-xs mx-auto">
                  <h3 className="text-xs font-bold text-slate-300">No Registrations Yet</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Google Form submissions will appear here automatically upon synchronization.
                  </p>
                </div>
                <Link
                  href="/registrations"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sync Google Sheet</span>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {registrations.map((reg: any) => (
                  <div
                    key={reg.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/20 px-2 rounded-2xl transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{reg.fullName}</span>
                        <StatusBadge status={reg.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>Room {reg.requestedRoomNumber || 'Unassigned'}</span>
                        <span>•</span>
                        <span>{reg.occupation} {reg.companyOrCollegeName ? `(${reg.companyOrCollegeName})` : ''}</span>
                        <span>•</span>
                        <span>Check-in: {reg.checkInDate ? formatIndianDate(reg.checkInDate) : 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/registrations/${reg.id}`}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Review</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Residents Summary Section */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Active Residents</h2>
                  <p className="text-[11px] text-slate-400">Onboarded & room-allotted occupants</p>
                </div>
              </div>
              <Link
                href="/residents"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <span>Resident Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {metrics.activeResidents === 0 ? (
              <div className="py-10 text-center space-y-2.5 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Users className="w-9 h-9 text-slate-600 mx-auto" />
                <div className="max-w-sm mx-auto">
                  <h3 className="text-xs font-bold text-slate-300">No active residents yet</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Applicants will appear as active residents once their Google Form registration is approved by the owner.
                  </p>
                </div>
                {metrics.pendingRegistrations > 0 && (
                  <Link
                    href="/registrations"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    <span>Approve Pending Registrations</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {recentResidents.map((res: any) => (
                  <div
                    key={res.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-800/20 px-2 rounded-2xl transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{res.fullName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Room {res.roomNumber} (Floor {res.floor}) • Joined: {formatIndianDate(res.checkInDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-400">{formatCurrency(res.monthlyRent)}/mo</div>
                      <StatusBadge status={res.status} className="mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Room Capacity + Payment Breakdown (Span 1) */}
        <div className="space-y-6">
          {/* Room Capacity & Floor Distribution (Strictly Rooms - Zero Beds) */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Room Capacity</h2>
                  <p className="text-[11px] text-slate-400">Floor & occupancy status</p>
                </div>
              </div>
              <Link href="/rooms" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                Manage
              </Link>
            </div>

            <div className="space-y-3 pt-1">
              {floorBreakdown.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No rooms configured in database</div>
              ) : (
                floorBreakdown.map((f: any) => {
                  const pct = f.capacity > 0 ? Math.round((f.occupied / f.capacity) * 100) : 0;
                  return (
                    <div key={f.floor} className="space-y-1.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">Floor {f.floor}</span>
                        <span className="text-[11px] text-slate-400">
                          {f.occupied} / {f.capacity} residents ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>{f.roomsCount} Rooms</span>
                        <span>{f.capacity - f.occupied} Spots Free</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payments & Receipts Summary */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Monthly Billing</h2>
                  <p className="text-[11px] text-slate-400">Rent collections & receipts</p>
                </div>
              </div>
              <Link href="/payments" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                Ledger
              </Link>
            </div>

            {metrics.activeResidents === 0 ? (
              <div className="py-6 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <CreditCard className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 px-4 leading-relaxed">
                  No payment records yet. Payment tracking becomes available after residents are approved.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Collected This Month</span>
                    <span className="text-sm font-black text-emerald-400">{formatCurrency(metrics.totalPaymentsCollected)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Receipts</span>
                    <span className="text-sm font-black text-slate-200">{metrics.totalReceiptsCount} Issued</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/60 pt-1">
                  {recentPayments.map((p: any) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-200 block">{p.residentName}</span>
                        <span className="text-[10px] text-slate-400">Room {p.roomNumber} • {p.billingMonth}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-200 block">{formatCurrency(p.totalAmountDue)}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent System Audit Activity */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">System Activity</h2>
                <p className="text-[11px] text-slate-400">Audit trail & synchronization logs</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {recentAuditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No recent activity logged</p>
              ) : (
                recentAuditLogs.map((log: any) => (
                  <div key={log.id} className="p-2.5 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                      <span className="text-amber-400">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      By: <span className="text-slate-300">{log.adminName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

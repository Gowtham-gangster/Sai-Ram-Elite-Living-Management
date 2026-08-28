'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DoorOpen,
  Users,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Receipt,
  FileCheck2,
  CalendarCheck,
  UserPlus,
  ArrowUpRight,
  CheckCircle2,
  Calendar,
  Building,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  ShieldAlert,
  Flame,
  PieChart,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { formatSharingType } from '@/lib/formatters';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to load dashboard statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Skeleton Loading State
  if (isLoading || !data) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Welcome Banner Skeleton */}
        <div className="h-36 rounded-3xl bg-slate-900 border border-slate-800" />

        {/* Stat Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-slate-800" />
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-900 border border-slate-800" />
          ))}
        </div>

        {/* Widgets Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-3xl bg-slate-900 border border-slate-800" />
          <div className="h-96 rounded-3xl bg-slate-900 border border-slate-800" />
        </div>
      </div>
    );
  }

  const m = data.metrics || {};
  const v = data.visualizations || {};

  return (
    <div className="space-y-8">
      {/* 1. Welcome Header Banner & Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-navy-900 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl shadow-black/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>SAIRAM ELITE LIVING • Control Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hostel Management Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Real-time room occupancy, billing cycles, collection ledger, and resident lifecycle metrics.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/residents"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-sky-400" />
              <span>+ Add Resident</span>
            </Link>

            <Link
              href="/admin/rooms"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <DoorOpen className="w-4 h-4 text-brand-400" />
              <span>+ Add Room</span>
            </Link>

            <Link
              href="/admin/payments"
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-1.5 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Top Primary Metrics (Occupancy & Rooms) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Occupancy Percentage"
          value={`${m.occupancyPercentage}%`}
          subtitle={`${m.totalActiveResidents} active / ${m.totalRoomCapacity} capacity`}
          icon={Users}
          accentColor="brand"
        />

        <StatCard
          title="Total Rooms"
          value={m.totalRooms}
          subtitle={`${m.totalRoomCapacity} total resident capacity`}
          icon={DoorOpen}
          accentColor="sky"
        />

        <StatCard
          title="Available Capacity"
          value={`${m.availableCapacity} Slots`}
          subtitle="Ready for new admissions"
          icon={Building}
          accentColor="emerald"
        />

        <StatCard
          title="New Residents This Month"
          value={m.newResidentsThisMonth}
          subtitle={`Onboarded in ${m.currentBillingMonth}`}
          icon={UserPlus}
          accentColor="amber"
        />
      </div>

      {/* 3. Secondary Financial & Tenancy Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Payments Collected */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collected ({m.currentBillingMonth})</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            ₹{(m.paymentsCollectedThisMonth || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Verified payment records</p>
        </div>

        {/* Pending Payments */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Dues</p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
            ₹{(m.pendingPaymentsAmount || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {m.pendingPaymentsCount} resident(s) with pending dues
          </p>
        </div>

        {/* Overdue Payments */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue Payments</p>
          <p className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
            ₹{(m.overduePaymentsAmount || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {m.overduePaymentsCount} overdue account(s)
          </p>
        </div>

        {/* Notice & Upcoming Checkouts */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notice & Checkouts</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl sm:text-2xl font-black text-amber-400">
              {m.residentsInNoticePeriod}
            </span>
            <span className="text-xs text-slate-500">notice /</span>
            <span className="text-xl sm:text-2xl font-black text-slate-300">
              {m.upcomingCheckoutsCount}
            </span>
            <span className="text-xs text-slate-500">checkouts</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Next 30 days vacating</p>
        </div>
      </div>

      {/* 4. Main Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Payment Status Breakdown & Recent Payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Payment Collection Overview */}
          <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand-400" />
                  <span>Monthly Payment Collection ({m.currentBillingMonth})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Breakdown of collected revenue, submitted transfers, and pending dues.
                </p>
              </div>

              <Link
                href="/admin/payments"
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Payment Status Pills Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Paid & Verified</span>
                <span className="text-lg font-black text-emerald-400 mt-0.5 block">
                  {v.paymentStatusDistribution?.PAID || 0}
                </span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Submitted (Review)</span>
                <span className="text-lg font-black text-sky-400 mt-0.5 block">
                  {v.paymentStatusDistribution?.SUBMITTED || 0}
                </span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Pending (Unpaid)</span>
                <span className="text-lg font-black text-amber-400 mt-0.5 block">
                  {v.paymentStatusDistribution?.PENDING || 0}
                </span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Overdue</span>
                <span className="text-lg font-black text-rose-400 mt-0.5 block">
                  {v.paymentStatusDistribution?.OVERDUE || 0}
                </span>
              </div>
            </div>

            {/* Recent Payments Table */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Recent Payment Records & Verifications
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Resident</th>
                      <th className="py-2.5 px-3">Room</th>
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {v.recentPayments?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No recent payment records.
                        </td>
                      </tr>
                    ) : (
                      v.recentPayments?.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-slate-200">{p.residentName}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400">
                            Room {p.roomNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-400">{p.billingMonth}</td>
                          <td className="py-3 px-3 font-extrabold text-white">
                            ₹{p.totalAmountDue.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            {p.receiptNumber ? (
                              <Link
                                href={`/admin/receipts/${p.receiptNumber}`}
                                className="font-mono text-brand-400 hover:underline font-semibold text-[11px]"
                              >
                                {p.receiptNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Floor & Sharing Occupancy Breakdown Visualizations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Floor Breakdown */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-brand-400" />
                Floor Occupancy Overview
              </h3>

              <div className="space-y-3">
                {v.floorBreakdown?.map((f: any) => {
                  const percent = f.capacity > 0 ? Math.round((f.occupied / f.capacity) * 100) : 0;
                  return (
                    <div key={f.floor} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-200">Floor {f.floor} ({f.roomsCount} Rooms)</span>
                        <span className="text-brand-400">{f.occupied} / {f.capacity} slots ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sharing Type Breakdown */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Sharing Distribution
              </h3>

              <div className="space-y-3">
                {v.sharingBreakdown?.map((s: any) => {
                  const percent = s.capacity > 0 ? Math.round((s.occupied / s.capacity) * 100) : 0;
                  return (
                    <div key={s.sharingType} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-200">{formatSharingType(s.sharingType)} ({s.count} Rooms)</span>
                        <span className="text-sky-400">{s.occupied} / {s.capacity} Filled</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Upcoming Payment Dues & Recent Residents */}
        <div className="space-y-6">
          {/* Upcoming Payment Dues Action Box */}
          <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Upcoming Payment Dues
              </h3>
              <Link
                href="/admin/payments?status=PENDING"
                className="text-[11px] font-semibold text-brand-400 hover:underline"
              >
                View Pending Dues →
              </Link>
            </div>

            {v.upcomingDues?.length === 0 ? (
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-center text-emerald-400 text-xs font-semibold">
                ✓ All resident dues are paid!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {v.upcomingDues?.map((d: any) => (
                  <div
                    key={d.id}
                    className="p-3 bg-slate-900/70 rounded-2xl border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-xs">{d.residentName}</span>
                        <span className="text-[10px] font-mono text-brand-400">R-{d.roomNumber}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Due: {new Date(d.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-rose-400 text-xs">
                        ₹{d.amount.toLocaleString('en-IN')}
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Residents Onboarded */}
          <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-400" />
                Recently Onboarded
              </h3>
              <Link href="/admin/residents" className="text-[11px] font-semibold text-brand-400 hover:underline">
                Directory →
              </Link>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {v.recentResidents?.map((r: any) => (
                <div
                  key={r.id}
                  className="p-3 bg-slate-900/70 rounded-2xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-200 text-xs">{r.fullName}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Room {r.roomNumber} • {r.phone}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(r.checkInDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

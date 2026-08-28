'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  ExternalLink,
  CheckCheck,
  Search,
  Filter,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMsg = n.message?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">System Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500 text-slate-950 font-black text-xs animate-pulse">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time activity feed for resident admissions, room transfers, payment receipts, and operational alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition-colors shrink-0"
          >
            <CheckCheck className="w-4 h-4 text-brand-400" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="ALL">All Categories</option>
              <option value="SUCCESS">Success / Payments</option>
              <option value="INFO">Info / Moves</option>
              <option value="WARNING">Warnings / Checkouts</option>
              <option value="ALERT">Alerts / Failures</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications Feed */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading notifications feed...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No notifications</h3>
            <p className="text-xs text-slate-400 mt-1">
              No operational events match your filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  !n.isRead ? 'bg-slate-900/80 border-l-4 border-brand-500' : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'SUCCESS' ? (
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : n.type === 'WARNING' ? (
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : n.type === 'ALERT' ? (
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Info className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white">{n.title}</h4>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">{n.message}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(n.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {n.linkUrl && (
                        <Link
                          href={n.linkUrl}
                          className="text-brand-400 hover:underline flex items-center gap-0.5 font-semibold"
                        >
                          <span>Open related record</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {!n.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(n.id)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg text-xs font-semibold shrink-0"
                    title="Mark read"
                  >
                    <CheckCheck className="w-4 h-4 text-slate-500 hover:text-brand-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Bell,
  LogOut,
  User,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface TopHeaderProps {
  onMenuClick: () => void;
}

export function TopHeader({ onMenuClick }: TopHeaderProps) {
  const router = useRouter();
  const [userName, setUserName] = useState<string>('Administrator');
  const [userRole, setUserRole] = useState<string>('SUPER_ADMIN');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    // Fetch Current User
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserName(data.user.name);
          setUserRole(data.user.role);
        }
      })
      .catch(() => {});

    // Fetch Notifications count
    fetchNotifications();
  }, []);

  const fetchNotifications = () => {
    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (data.notifications) {
          setNotifications(data.notifications.slice(0, 5));
          setUnreadNotifications(data.unreadCount || 0);
        }
      })
      .catch(() => {});
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      router.push('/admin/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const markAllNotificationsRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setUnreadNotifications(0);
    fetchNotifications();
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between">
      {/* Left items */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-400">
          <div className="w-5 h-5 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
            <img src="/logo.png" alt="Sai Ram Hostel Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-slate-300">SAIRAM ELITE LIVING</span>
          <span className="text-slate-600">/</span>
          <span className="text-amber-400">Admin Control Center</span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                {unreadNotifications}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-400" /> Notifications
                </h4>
                {unreadNotifications > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-brand-400 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto py-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No notifications yet</p>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="py-2.5 px-2 hover:bg-slate-800/40 rounded-lg">
                      <div className="flex items-start gap-2">
                        {notif.type === 'SUCCESS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : notif.type === 'WARNING' || notif.type === 'ALERT' ? (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Bell className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-slate-200">{notif.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 text-center">
                <Link
                  href="/admin/notifications"
                  onClick={() => setShowNotifMenu(false)}
                  className="text-xs text-brand-400 hover:underline font-medium inline-flex items-center gap-1"
                >
                  View all notifications <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-bold text-slate-200">{userName}</span>
            <span className="text-[10px] text-brand-400 font-semibold flex items-center gap-1 uppercase">
              <ShieldCheck className="w-3 h-3" /> {userRole?.replace('_', ' ')}
            </span>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Logout"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg border border-rose-500/20 transition-all disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

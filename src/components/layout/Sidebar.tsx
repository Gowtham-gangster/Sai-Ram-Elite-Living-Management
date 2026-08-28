'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  UserPlus,
  CreditCard,
  Receipt,
  BellRing,
  FileBarChart,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Residents', href: '/residents', icon: Users },
  { name: 'Rooms', href: '/rooms', icon: DoorOpen },
  { name: 'Registrations', href: '/registrations', icon: UserPlus },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Receipts', href: '/receipts', icon: Receipt },
  { name: 'Reminders', href: '/reminders', icon: BellRing },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  onNavClick?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ onNavClick, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { profile, role, signOut, isLoading } = useAuth();

  const handleLinkClick = () => {
    if (onNavClick) onNavClick();
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className="w-64 bg-slate-950/95 border-r border-slate-800/80 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
          <DoorOpen className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <h1 className="font-extrabold text-white text-sm tracking-wide leading-tight">
            SAIRAM ELITE
          </h1>
          <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase block">
            Living Management
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Management Portal
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout Bottom Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">
                {profile?.full_name || 'Administrator'}
              </p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                {role || 'OWNER'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            disabled={isLoading}
            title="Sign out of management portal"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

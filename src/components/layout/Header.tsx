'use client';

import React from 'react';
import { Menu, Bell, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './Sidebar';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { profile, role, signOut, isLoading } = useAuth();

  const currentItem = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  const pageTitle = currentItem ? currentItem.name : 'Hostel Management';

  return (
    <header className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
            {pageTitle}
          </h2>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            SAIRAM ELITE LIVING • Administrative Portal
          </p>
        </div>
      </div>

      {/* Right: Quick User Info & Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-200">
            {profile?.full_name || 'Administrator'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
            {role?.replace('_', ' ') || 'SUPER ADMIN'}
          </span>
        </div>

        <button
          type="button"
          onClick={signOut}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-xl text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}

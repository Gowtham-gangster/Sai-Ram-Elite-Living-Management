'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { X } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex">
      {/* Desktop Sidebar (Permanent) */}
      <div className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer */}
          <div className="relative w-64 max-w-[80vw] bg-slate-950 h-full shadow-2xl z-10 flex flex-col">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="absolute top-4 right-3 p-2 text-slate-400 hover:text-white bg-slate-900 rounded-xl border border-slate-800"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            <Sidebar onNavClick={() => setMobileDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuToggle={() => setMobileDrawerOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

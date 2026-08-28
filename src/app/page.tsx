'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, DoorOpen } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
        <DoorOpen className="w-6 h-6" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        <span className="font-semibold text-slate-300">Loading SAIRAM ELITE LIVING Management...</span>
      </div>
    </div>
  );
}

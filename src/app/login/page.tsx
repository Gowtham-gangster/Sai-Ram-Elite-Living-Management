'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DoorOpen,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState('admin@sairam.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Invalid email or password. Please verify your administrator credentials.');
        return;
      }

      await refreshProfile();
      router.push(callbackUrl);
      router.refresh();
    } catch (err: any) {
      setErrorMessage('An unexpected authentication error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    setEmail('admin@sairam.com');
    setPassword('admin123');
    setErrorMessage(null);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4" noValidate>
      {/* Error Alert Message */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-bold text-slate-300 tracking-wide"
        >
          Administrator Email <span className="text-amber-400">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Mail className="w-4 h-4" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@sairam.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-xs font-bold text-slate-300 tracking-wide"
          >
            Password <span className="text-amber-400">*</span>
          </label>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In to Management Portal</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Quick Auto-fill for Administrator */}
      <div className="pt-3 border-t border-slate-800/80 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span>Default: </span>
          <span className="font-mono text-slate-200">admin@sairam.com</span> /{' '}
          <span className="font-mono text-slate-200">admin123</span>
          <button
            type="button"
            onClick={fillDefaultCredentials}
            className="text-amber-400 hover:underline font-semibold ml-1 cursor-pointer"
          >
            Auto-fill
          </button>
        </div>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/25 border border-amber-300/30">
            <DoorOpen className="w-8 h-8 text-slate-950 font-black" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            SAIRAM ELITE LIVING
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-amber-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hostel Management System</span>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Authorized administrator access for hostel operations, rooms, resident records, and monthly billing.
          </p>
        </div>

        {/* Login Form Panel */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl shadow-black/60">
          <Suspense
            fallback={
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading portal login...</span>
              </div>
            }
          >
            <LoginFormContent />
          </Suspense>
        </div>

        {/* Security Footer Notice */}
        <div className="text-center">
          <p className="text-[11px] text-slate-500">
            🔒 Private & Confidential • Strictly for authorized hostel administrators only.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  CreditCard,
  QrCode,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Lock,
  Download,
  FileText,
  Receipt,
  Edit3,
  Search,
  RefreshCw,
  Calendar,
  LogOut,
  UserCheck,
} from 'lucide-react';

interface ResidentData {
  id: string;
  name: string;
  roomNumber: string;
  maskedMobile: string;
  status: string;
}

interface PaymentData {
  id: string;
  billingMonth: string;
  rawBillingMonth: string;
  rentAmount: number;
  maintenanceAmount: number;
  penaltyAmount: number;
  discountAmount: number;
  totalAmountDue: number;
  status: string;
  isPaid: boolean;
  dueDateFormatted: string;
}

interface InitiationResult {
  referenceId: string;
  paymentSessionId?: string;
  payeeName: string;
  upiId: string;
  amount: number;
  standardUpiUrl: string;
  appIntentUrl: string;
  gpayUrl?: string;
  phonepeUrl?: string;
  paytmUrl?: string;
  gpayIntentUrl?: string;
  phonepeIntentUrl?: string;
  paytmIntentUrl?: string;
  qrDataUrl?: string;
  expiresAt?: string;
  timeoutSeconds?: number;
  selectedApp: string;
}

export default function ResidentPaymentPortal() {
  const [mounted, setMounted] = useState(false);

  // Navigation Tabs: 'pay' | 'receipts'
  const [activeTab, setActiveTab] = useState<'pay' | 'receipts'>('pay');

  // Navigation Screens: 1 (Login) | 2 (Dues Summary) | 3 (Amount Edit) | 4 (Pay with UPI: QR + Apps) | 6 (Success)
  const [screen, setScreen] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Form & Lookup state
  const [mobileInput, setMobileInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded resident and payment data
  const [resident, setResident] = useState<ResidentData | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);

  // Amount Editing State
  const [customAmountInput, setCustomAmountInput] = useState<string>('');

  // UPI Initiation & Verification State
  const [isInitiating, setIsInitiating] = useState(false);
  const [initiationResult, setInitiationResult] = useState<InitiationResult | null>(null);

  // Unified Payment Session Timer State (10-minute authoritative expiration)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);

  // Polling State for Server Verification
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [verifiedPaymentData, setVerifiedPaymentData] = useState<any>(null);

  // Receipts View State
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState<boolean>(false);
  const [receiptSearch, setReceiptSearch] = useState<string>('');

  // Auto-restore active resident session on mount
  useEffect(() => {
    const restoreResidentSession = async () => {
      try {
        const res = await fetch('/api/pay/session');
        const data = await res.json();
        if (res.ok && data.authenticated && data.resident) {
          setResident(data.resident);
          setPayment(data.payment);
          setCustomAmountInput(String(data.payment?.totalAmountDue || 0));
          setScreen(2);
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setMounted(true);
      }
    };

    restoreResidentSession();
  }, []);

  // Update custom amount when payment dues load
  useEffect(() => {
    if (payment) {
      setCustomAmountInput(String(payment.totalAmountDue || 0));
    }
  }, [payment]);

  // Fetch receipts for resident
  const fetchResidentReceipts = async (residentId?: string) => {
    try {
      setIsLoadingReceipts(true);
      const res = await fetch('/api/pay/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: residentId || resident?.id,
          mobileNumber: !residentId && !resident ? mobileInput : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.receipts) {
        setReceiptsList(data.receipts);
      }
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  // Load receipts when tab switches to receipts
  useEffect(() => {
    if (activeTab === 'receipts') {
      if (resident) {
        fetchResidentReceipts(resident.id);
      } else if (mobileInput.length === 10) {
        fetchResidentReceipts();
      }
    }
  }, [activeTab, resident]);

  // Polling effect when on Screen 4 or Screen 5 (UPI Payment Active)
  useEffect(() => {
    if ((screen !== 4 && screen !== 5) || !initiationResult?.referenceId) return;

    let intervalId: any;
    let attempts = 0;
    const maxAttempts = 15; // Poll for up to 60 seconds

    const checkStatus = async () => {
      attempts++;
      setPollCount(attempts);
      try {
        const res = await fetch(`/api/pay/status/${encodeURIComponent(initiationResult.referenceId)}`);
        const data = await res.json();

        if (data.found && (data.isPaid || data.isPartiallyPaid)) {
          setVerifiedPaymentData(data);
          setScreen(6);
          clearInterval(intervalId);
        } else if (attempts >= maxAttempts) {
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Status check error:', err);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 3500);

    return () => clearInterval(intervalId);
  }, [screen, initiationResult?.referenceId]);

  // Unified Payment Session Timer Effect (10-minute authoritative countdown)
  useEffect(() => {
    if (screen !== 4 || !initiationResult?.expiresAt) return;

    const updateTimer = () => {
      const expiresTime = new Date(initiationResult.expiresAt!).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresTime - now) / 1000));
      setSecondsRemaining(diff);
      if (diff <= 0) {
        setIsSessionExpired(true);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [screen, initiationResult?.expiresAt]);

  const formatCountdown = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleManualCheck = async () => {
    if (!initiationResult?.referenceId) return;
    setIsPolling(true);
    try {
      const res = await fetch(`/api/pay/status/${encodeURIComponent(initiationResult.referenceId)}`);
      const data = await res.json();
      if (data.found && (data.isPaid || data.isPartiallyPaid)) {
        setVerifiedPaymentData(data);
        setScreen(6);
      } else {
        setError(
          'Payment confirmation is pending. If your bank or UPI app reported an error or bank transfer limit, please retry with a smaller installment amount.'
        );
        setTimeout(() => setError(null), 6000);
      }
    } catch (err) {
      setError('Unable to verify payment status. Please try again.');
    } finally {
      setIsPolling(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileInput || mobileInput.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/pay/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobileInput }),
      });

      const data = await res.json();

      if (!res.ok || !data.found) {
        setError(data.error || 'No active resident found matching this mobile number.');
        return;
      }

      setResident(data.resident);
      setPayment(data.payment);
      setCustomAmountInput(String(data.payment?.totalAmountDue || 0));

      if (activeTab === 'receipts') {
        fetchResidentReceipts(data.resident.id);
      } else {
        setScreen(2);
      }
    } catch (err: any) {
      setError('Network error connecting to hostel server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit resident Logout
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/pay/logout', { method: 'POST' });
      setResident(null);
      setPayment(null);
      setMobileInput('');
      setCustomAmountInput('');
      setInitiationResult(null);
      setVerifiedPaymentData(null);
      setReceiptsList([]);
      setScreen(1);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Proceed directly from Screen 3 to Screen 4 (Generates QR & App links dynamically)
  const handleProceedToUpiPage = async () => {
    if (!payment) return;
    try {
      setIsInitiating(true);
      setError(null);

      const amountToPay = Number(customAmountInput) || payment.totalAmountDue;

      if (amountToPay <= 0 || amountToPay > payment.totalAmountDue) {
        setError(`Please enter a valid amount up to ₹${payment.totalAmountDue.toLocaleString('en-IN')}`);
        setIsInitiating(false);
        return;
      }

      const res = await fetch('/api/pay/initiate-upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          upiApp: 'gpay',
          customAmount: amountToPay,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to initiate UPI session. Please try again.');
        return;
      }

      setInitiationResult(data);
      setScreen(4);
    } catch (err: any) {
      setError('Failed to connect with payment gateway. Please try again.');
    } finally {
      setIsInitiating(false);
    }
  };

  // Launch UPI app using canonical standard UPI protocol
  const handleLaunchUpiApp = (_appType: 'gpay' | 'phonepe' | 'paytm') => {
    if (!initiationResult) return;

    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent || '');

    if (!isMobile) {
      setError(
        'UPI apps can only be opened directly on your mobile device. Please scan the QR code above using your mobile UPI app.'
      );
      setTimeout(() => setError(null), 6000);
      return;
    }

    const upiUrl = initiationResult.standardUpiUrl || initiationResult.appIntentUrl;

    try {
      window.location.href = upiUrl;
    } catch (err) {
      console.warn('UPI launch error:', err);
    }
  };

  // Calculations for Screen 3
  const parsedPayingAmount = Number(customAmountInput) || 0;
  const billAmountDue = payment?.totalAmountDue || 0;
  const calculatedRemainingBalance = Math.max(0, billAmountDue - parsedPayingAmount);

  // Filtered receipts list
  const filteredReceipts = receiptsList.filter((r) => {
    if (!receiptSearch) return true;
    const s = receiptSearch.toLowerCase();
    return (
      r.receiptNumber.toLowerCase().includes(s) ||
      r.billingMonth.toLowerCase().includes(s)
    );
  });

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" suppressHydrationWarning>
        <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5" suppressHydrationWarning>
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg p-0.5 overflow-hidden shrink-0">
                <img src="/logo.png" alt="Sai Ram Hostel Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xs font-black tracking-wider uppercase text-white">SAIRAM ELITE LIVING</h1>
                <p className="text-[10px] text-amber-400 font-semibold tracking-wide">RESIDENT PAYMENT PORTAL</p>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-md w-full mx-auto px-4 py-6 flex-1 flex flex-col justify-center" suppressHydrationWarning>
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 shadow-xl p-1 overflow-hidden">
              <img src="/logo.png" alt="Sai Ram Hostel Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xl font-black text-white">Rent Payment</h2>
            <p className="text-xs text-slate-400">Loading secure portal...</p>
          </div>
        </main>
        <footer className="border-t border-slate-900 py-4 px-4 text-center text-[10px] text-slate-600">
          <p>© 2026 SAIRAM ELITE LIVING • Managed Hostel Portal</p>
        </footer>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950"
      suppressHydrationWarning
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5" suppressHydrationWarning>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg p-0.5 overflow-hidden shrink-0">
              <img src="/logo.png" alt="Sai Ram Hostel Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-wider uppercase text-white">
                SAIRAM ELITE LIVING
              </h1>
              <p className="text-[10px] text-amber-400 font-semibold tracking-wide">
                RESIDENT PAYMENT PORTAL
              </p>
            </div>
          </div>

          {/* Navigation & Auth Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-inner" suppressHydrationWarning>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('pay');
                  if (resident) setScreen(2);
                }}
                suppressHydrationWarning
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'pay'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pay Rent
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('receipts');
                  if (resident) fetchResidentReceipts(resident.id);
                }}
                suppressHydrationWarning
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'receipts'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3 h-3" />
                <span>Receipts</span>
              </button>
            </div>

            {resident && (
              <button
                type="button"
                onClick={handleLogout}
                title="Logout session"
                suppressHydrationWarning
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area (Mobile-First Container) */}
      <main className="max-w-md w-full mx-auto px-4 py-6 flex-1 flex flex-col justify-center" suppressHydrationWarning>
        {/* ========================================================================= */}
        {/* TAB 1: PAY RENT FLOW */}
        {/* ========================================================================= */}
        {activeTab === 'pay' && (
          <>
            {/* SCREEN 1: Mobile Number Input */}
            {screen === 1 && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-2 shadow-xl p-1 overflow-hidden">
                    <img src="/logo.png" alt="Sai Ram Hostel Logo" className="w-full h-full object-contain" />
                  </div>
                  <h2 className="text-xl font-black text-white">Rent Payment</h2>
                  <p className="text-xs text-slate-400">
                    Enter your registered mobile number to view and pay your monthly rent.
                  </p>
                </div>

                <form onSubmit={handleLookup} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobileInput"
                      className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider"
                    >
                      Registered Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-400 font-bold text-xs border-r border-slate-800 pr-2.5">
                        <span>🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <input
                        id="mobileInput"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        value={mobileInput}
                        onChange={(e) => {
                          setMobileInput(e.target.value.replace(/[^\d]/g, '').slice(0, 10));
                          if (error) setError(null);
                        }}
                        placeholder="98765 43210"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-20 pr-4 py-3.5 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all tracking-wider font-mono"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in shake">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || mobileInput.length !== 10}
                    className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Finding Resident Details...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Instant lookup • Direct UPI transfer to hostel owner account</span>
                </div>
              </div>
            )}

            {/* SCREEN 2: Welcome Resident & Dues Summary */}
            {screen === 2 && resident && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Resident Card */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                        Welcome Back
                      </span>
                      <h2 className="text-base font-black text-white">{resident.name}</h2>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                      Room {resident.roomNumber}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Registered Mobile:</span>
                    <span className="font-mono text-slate-300 font-semibold">{resident.maskedMobile}</span>
                  </div>
                </div>

                {/* Payment Dues Card */}
                {payment ? (
                  <div className="p-5 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Billing Month
                      </span>
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        {payment.billingMonth}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">Monthly Rent:</span>
                        <span className="text-sm font-bold text-slate-200">
                          ₹{payment.rentAmount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {payment.maintenanceAmount > 0 && (
                        <div className="flex items-baseline justify-between text-xs text-slate-400">
                          <span>Maintenance:</span>
                          <span className="font-semibold text-slate-200">
                            ₹{payment.maintenanceAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {payment.discountAmount > 0 && (
                        <div className="flex items-baseline justify-between text-xs text-emerald-400">
                          <span>Discount:</span>
                          <span className="font-semibold">-₹{payment.discountAmount.toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      <div className="border-t border-slate-800 pt-2.5 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-white">Amount Due</span>
                        <span className="text-2xl font-black text-amber-400">
                          ₹{payment.totalAmountDue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Due Date: {payment.dueDateFormatted}</span>
                      </div>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full ${
                          payment.isPaid
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>

                    {payment.isPaid ? (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span className="font-semibold">
                          Your rent for {payment.billingMonth} has already been received. Thank you!
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setScreen(3)}
                        className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                      >
                        <span>Continue to Payment</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-bold text-white">No Outstanding Dues</h3>
                    <p className="text-xs text-slate-400">
                      You currently have no pending payment bills generated.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SCREEN 3: Confirm & Edit Payment Amount */}
            {screen === 3 && resident && payment && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                  type="button"
                  onClick={() => setScreen(2)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Summary</span>
                </button>

                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-white">Confirm Payment Amount</h2>
                  <p className="text-xs text-slate-400">You can pay in full or enter a partial installment amount.</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Resident Name</span>
                      <span className="font-bold text-white">{resident.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Room Number</span>
                      <span className="font-bold text-white">Room {resident.roomNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Billing Month</span>
                      <span className="font-bold text-amber-400">{payment.billingMonth}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Total Billed Due</span>
                      <span className="font-bold text-slate-200">₹{payment.totalAmountDue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Editable Amount Input Box */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label htmlFor="customAmountInput" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Amount to Pay (INR)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setCustomAmountInput(String(payment.totalAmountDue))}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline"
                      >
                        Reset to Full (₹{payment.totalAmountDue})
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-amber-400 font-black text-lg">₹</span>
                      <input
                        id="customAmountInput"
                        type="number"
                        min="1"
                        max={payment.totalAmountDue}
                        step="1"
                        value={customAmountInput}
                        onChange={(e) => {
                          setCustomAmountInput(e.target.value);
                          if (error) setError(null);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-lg font-black text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono tracking-wide"
                      />
                    </div>

                    {/* Live Calculation Display */}
                    <div className="space-y-1 pt-1 text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Amount Paying in this UPI Attempt:</span>
                        <span className="font-bold text-emerald-400">₹{parsedPayingAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Remaining Balance After Settlement:</span>
                        <span className={`font-bold ${calculatedRemainingBalance > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                          ₹{calculatedRemainingBalance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isInitiating || parsedPayingAmount <= 0 || parsedPayingAmount > payment.totalAmountDue}
                  onClick={handleProceedToUpiPage}
                  className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                >
                  {isInitiating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Generating QR & UPI Options...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to UPI (₹{parsedPayingAmount.toLocaleString('en-IN')})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* SCREEN 4: Pay with UPI (Direct QR Code + Google Pay / PhonePe / Paytm Options) */}
            {screen === 4 && resident && initiationResult && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                  type="button"
                  onClick={() => {
                    setIsSessionExpired(false);
                    setScreen(3);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Amount Selection</span>
                </button>

                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-white">Pay with UPI</h2>
                  <p className="text-xs text-slate-400">Choose your preferred UPI payment method or scan & pay</p>
                </div>

                {/* Summary Pill & Session Countdown Timer */}
                <div className="space-y-2">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between font-bold">
                    <span>Paying: ₹{initiationResult.amount.toLocaleString('en-IN')}</span>
                    <span className="text-[11px] font-semibold text-slate-400">Room {resident.roomNumber}</span>
                  </div>

                  {/* Real-Time Authoritative Countdown Badge */}
                  <div className="p-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-semibold">
                      <Clock
                        className={`w-3.5 h-3.5 ${
                          secondsRemaining < 120 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                        }`}
                      />
                      <span>Payment Session</span>
                    </div>
                    <span
                      className={`font-mono font-bold text-xs ${
                        secondsRemaining < 120 ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      {secondsRemaining > 0
                        ? `Expires in ${formatCountdown(secondsRemaining)}`
                        : 'Session Expired'}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                {/* EXPIRED SESSION STATE */}
                {isSessionExpired ? (
                  <div className="p-6 rounded-3xl bg-slate-900 border border-rose-500/30 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-black text-white">Payment Session Expired</h3>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                        This 10-minute payment session has expired for security. Please start a new payment session to complete your transfer.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSessionExpired(false);
                        setInitiationResult(null);
                        setScreen(3);
                      }}
                      className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-950" />
                      <span>Start New Payment</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* ========================================================================= */}
                    {/* 1. DIRECT QR CODE SECTION (Scan & Pay immediately visible) */}
                    {/* ========================================================================= */}
                    <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3.5 shadow-xl">
                      <div className="space-y-0.5">
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                          <QrCode className="w-4 h-4" />
                          <span>Scan & Pay</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Scan this QR code using any UPI app to pay
                        </p>
                      </div>

                      {/* High-Resolution Clean QR Code Box */}
                      <div className="bg-white p-3 rounded-2xl w-60 h-60 mx-auto flex items-center justify-center shadow-lg border border-slate-700">
                        <img
                          src={
                            initiationResult.qrDataUrl ||
                            `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                              initiationResult.standardUpiUrl
                            )}`
                          }
                          alt="UPI Payment QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                {/* ========================================================================= */}
                {/* 2. CHOOSE UPI APP SECTION (Google Pay, PhonePe, Paytm) */}
                {/* ========================================================================= */}
                <div className="relative text-center my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <span className="relative bg-slate-950 px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    OR
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="text-left px-1">
                    <h3 className="text-xs font-bold text-slate-200">Choose UPI App</h3>
                    <p className="text-[11px] text-slate-500">Pay directly using your preferred app</p>
                  </div>

                  {/* 1. Google Pay Button */}
                  <button
                    type="button"
                    onClick={() => handleLaunchUpiApp('gpay')}
                    className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-850 active:scale-[0.99] border border-slate-800 hover:border-blue-500/40 text-left flex items-center justify-between group transition-all shadow-md cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-black text-xs text-blue-400">
                        GPay
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                          Google Pay
                        </h4>
                        <p className="text-[10px] text-slate-400">Pay directly via Google Pay app</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>

                  {/* 2. PhonePe Button */}
                  <button
                    type="button"
                    onClick={() => handleLaunchUpiApp('phonepe')}
                    className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-850 active:scale-[0.99] border border-slate-800 hover:border-purple-500/40 text-left flex items-center justify-between group transition-all shadow-md cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-black text-xs text-purple-400">
                        Pe
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                          PhonePe
                        </h4>
                        <p className="text-[10px] text-slate-400">Pay directly via PhonePe app</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>

                  {/* 3. Paytm Button */}
                  <button
                    type="button"
                    onClick={() => handleLaunchUpiApp('paytm')}
                    className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-850 active:scale-[0.99] border border-slate-800 hover:border-cyan-500/40 text-left flex items-center justify-between group transition-all shadow-md cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-black text-xs text-cyan-400">
                        Paytm
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                          Paytm
                        </h4>
                        <p className="text-[10px] text-slate-400">Pay directly via Paytm app</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                </div>

                {/* ========================================================================= */}
                {/* 3. REAL-TIME SERVER VERIFICATION STATUS & MANUAL CHECK */}
                {/* ========================================================================= */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Server Verification Active</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {pollCount > 0 && pollCount <= 15 ? `Checking (${pollCount}/15)` : 'Standing by'}
                    </span>
                  </div>
                  <p>
                    Once your payment is completed via QR scan or UPI app, this page will automatically confirm your transaction and generate your receipt.
                  </p>
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isPolling}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-755 text-slate-200 font-semibold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isPolling ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-400" />
                    )}
                    <span>Check Payment Status Now</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

            {/* SCREEN 6: Payment Verified & Confirmed (SUCCESS) */}
            {screen === 6 && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-400 text-center">
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="w-9 h-9 animate-bounce" />
                  </div>
                  <h2 className="text-xl font-black text-white">Payment Confirmed!</h2>
                  <p className="text-xs text-slate-300 max-w-xs mx-auto font-medium">
                    Your rent payment has been verified by the hostel management system.
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 text-left space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs text-slate-400 font-semibold">Amount Paid</span>
                    <span className="text-xl font-black text-emerald-400">
                      ₹{Number(verifiedPaymentData?.amount || initiationResult?.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                        {verifiedPaymentData?.remainingBalance > 0 ? 'PARTIALLY PAID' : 'VERIFIED PAID'}
                      </span>
                    </div>
                    {verifiedPaymentData?.remainingBalance > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Balance Remaining:</span>
                        <span>₹{Number(verifiedPaymentData.remainingBalance).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resident:</span>
                      <span className="font-bold text-white">{resident?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room:</span>
                      <span className="font-semibold text-slate-200">Room {resident?.roomNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Billing Month:</span>
                      <span className="font-semibold text-amber-400">{payment?.billingMonth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference ID:</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {verifiedPaymentData?.referenceId || initiationResult?.referenceId}
                      </span>
                    </div>
                    {verifiedPaymentData?.receiptNumber && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                        <span className="text-slate-500">Receipt No:</span>
                        <span className="font-mono text-[11px] font-bold text-emerald-400">
                          {verifiedPaymentData.receiptNumber}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Official PDF Receipt Download Card */}
                <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 text-left space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-xs text-white font-bold">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Official Payment Receipt (PDF)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Your computer-generated receipt with hostel stamp and payment breakdown is ready.
                  </p>
                  <div className="flex flex-col gap-2">
                    <a
                      href={`/api/pay/receipt/${verifiedPaymentData?.downloadToken || verifiedPaymentData?.receiptNumber || verifiedPaymentData?.referenceId || initiationResult?.referenceId}`}
                      download
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF Receipt</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('receipts');
                        if (resident) fetchResidentReceipts(resident.id);
                      }}
                      className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Receipt className="w-4 h-4 text-amber-400" />
                      <span>View All My Receipts</span>
                    </button>
                  </div>
                </div>

                {/* RETURN BUTTON: Navigation only - Keeps Session Active */}
                <button
                  type="button"
                  onClick={() => setScreen(2)}
                  className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Payment Summary</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY RECEIPTS SECTION */}
        {/* ========================================================================= */}
        {activeTab === 'receipts' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <Receipt className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-white">Payment Receipts</h2>
              <p className="text-xs text-slate-400">
                View and download all your official monthly rent payment receipts.
              </p>
            </div>

            {!resident && (
              <form onSubmit={handleLookup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Enter Registered Mobile Number
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-400 font-bold text-xs border-r border-slate-800 pr-2.5">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={mobileInput}
                      onChange={(e) => {
                        setMobileInput(e.target.value.replace(/[^\d]/g, '').slice(0, 10));
                        if (error) setError(null);
                      }}
                      placeholder="98765 43210"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-20 pr-4 py-3.5 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono tracking-wider"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || mobileInput.length !== 10}
                  className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>View My Receipts</span>}
                </button>
              </form>
            )}

            {resident && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pay');
                      setScreen(2);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Payment Portal</span>
                  </button>

                  <div className="text-[11px] text-amber-400 font-semibold">
                    Room {resident.roomNumber} • {resident.name}
                  </div>
                </div>

                {/* Search / Filter Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search month or receipt number..."
                      value={receiptSearch}
                      onChange={(e) => setReceiptSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchResidentReceipts(resident.id)}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    title="Refresh receipts"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReceipts ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Receipts List */}
                {isLoadingReceipts ? (
                  <div className="py-12 text-center space-y-2 bg-slate-900/40 rounded-3xl border border-slate-800">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-400">Loading your payment receipts...</p>
                  </div>
                ) : filteredReceipts.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-slate-900/40 rounded-3xl border border-slate-800">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                    <h3 className="text-sm font-bold text-white">No Receipts Found</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      {receiptSearch
                        ? 'No receipts match your search term.'
                        : 'You do not have any payment receipts generated yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReceipts.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-md space-y-3 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                              Billing Month
                            </span>
                            <h3 className="text-sm font-black text-white">{r.billingMonth}</h3>
                          </div>
                          <span className="text-base font-black text-emerald-400">
                            ₹{Number(r.amountPaid).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                          <div className="flex justify-between">
                            <span>Receipt Number:</span>
                            <span className="font-mono text-amber-300 font-bold">{r.receiptNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Payment Date:</span>
                            <span className="text-slate-300">
                              {new Date(r.paymentDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Payment Mode:</span>
                            <span className="text-slate-300">{r.paymentMethod || 'UPI Intent'}</span>
                          </div>
                        </div>

                        <a
                          href={`/api/pay/receipt/${r.downloadToken || r.receiptNumber || r.id}`}
                          download
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF Receipt</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-slate-900 py-4 px-4 text-center text-[10px] text-slate-600">
        <p>© 2026 SAIRAM ELITE LIVING • Managed Hostel Portal</p>
      </footer>
    </div>
  );
}

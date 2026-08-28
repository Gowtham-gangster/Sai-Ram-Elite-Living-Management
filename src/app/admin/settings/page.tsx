'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  CreditCard,
  Bell,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Key,
  Lock,
  Phone,
  Mail,
  Globe,
  MapPin,
  Landmark,
  QrCode,
  Calendar,
  IndianRupee,
  Clock,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'HOSTEL' | 'PAYMENT' | 'REMINDER' | 'ACCOUNT'>('HOSTEL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    hostelName: 'SAIRAM ELITE LIVING',
    hostelAddress: 'Plot #42, ITPL Main Road, Near Prestige Tech Park, Whitefield, Bengaluru - 560066',
    contactPhone: '+91 98450 12345',
    whatsAppNumber: '+91 98450 12345',
    contactEmail: 'contact@sairameliteliving.com',
    websiteUrl: 'https://sairameliteliving.com',
    bankName: 'HDFC Bank',
    accountHolderName: 'SAIRAM ELITE LIVING HOSPITALITY LLP',
    accountNumber: '50200098765432',
    ifscCode: 'HDFC0001892',
    upiId: 'sairamelite@hdfcbank',
    paymentInstructions: 'Please transfer rent by the 5th of every month. Enter Resident Name & Room Number in remarks. Upload payment screenshot in management portal or share UTR with admin.',
    defaultDueDayOfMonth: 5,
    lateFeePerDay: 50,
    gracePeriodDays: 3,
    rulesAndRegulations: '1. Gate curfew at 10:30 PM.\n2. Non-resident visitors permitted in lounge only until 8:00 PM.\n3. AC and geyser to be switched off when leaving room.\n4. Quiet hours strictly observed (11 PM - 6 AM).\n5. 30-day notice required before vacating.',
  });

  // Admin Profile State
  const [adminUser, setAdminUser] = useState<any>(null);

  // Password Update State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Feedback State
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setSettingsForm({
          hostelName: data.settings.hostelName || '',
          hostelAddress: data.settings.hostelAddress || '',
          contactPhone: data.settings.contactPhone || '',
          whatsAppNumber: data.settings.whatsAppNumber || '',
          contactEmail: data.settings.contactEmail || '',
          websiteUrl: data.settings.websiteUrl || '',
          bankName: data.settings.bankName || '',
          accountHolderName: data.settings.accountHolderName || '',
          accountNumber: data.settings.accountNumber || '',
          ifscCode: data.settings.ifscCode || '',
          upiId: data.settings.upiId || '',
          paymentInstructions: data.settings.paymentInstructions || '',
          defaultDueDayOfMonth: data.settings.defaultDueDayOfMonth || 5,
          lateFeePerDay: data.settings.lateFeePerDay || 50,
          gracePeriodDays: data.settings.gracePeriodDays || 3,
          rulesAndRegulations: data.settings.rulesAndRegulations || '',
        });
      }
      if (data.adminUser) {
        setAdminUser(data.adminUser);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Settings Update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setActionSuccess('Hostel settings updated and saved securely.');
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(null), 4500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Loading administrative settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Hostel & System Settings</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Admin Private Data</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure hostel contact profiles, banking instructions, billing policies, and admin security credentials.
          </p>
        </div>
      </div>

      {/* Global Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('HOSTEL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'HOSTEL'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>1. Hostel Information</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PAYMENT'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>2. Payment Information</span>
        </button>

        <button
          onClick={() => setActiveTab('REMINDER')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'REMINDER'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>3. Reminder & Policy Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('ACCOUNT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ACCOUNT'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>4. Account & Security</span>
        </button>
      </div>

      {/* SECTION 1: HOSTEL INFORMATION */}
      {activeTab === 'HOSTEL' && (
        <form onSubmit={handleSaveSettings} className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-400" />
              <span>Hostel Profile Information</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official contact details and location for administrative receipts and communication headers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Hostel Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={settingsForm.hostelName}
                onChange={(e) => setSettingsForm({ ...settingsForm, hostelName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Official Website URL
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="url"
                  placeholder="https://sairameliteliving.com"
                  value={settingsForm.websiteUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, websiteUrl: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-medium focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Official Phone Number <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={settingsForm.contactPhone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Official WhatsApp Number <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  required
                  value={settingsForm.whatsAppNumber}
                  onChange={(e) => setSettingsForm({ ...settingsForm, whatsAppNumber: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-300 mb-1.5">
                Official Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={settingsForm.contactEmail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-300 mb-1.5">
                Hostel Physical Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <textarea
                  rows={2}
                  required
                  value={settingsForm.hostelAddress}
                  onChange={(e) => setSettingsForm({ ...settingsForm, hostelAddress: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Hostel Information'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 2: PAYMENT INFORMATION */}
      {activeTab === 'PAYMENT' && (
        <form onSubmit={handleSaveSettings} className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-brand-400" />
                  <span>Payment & Banking Information</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hostel bank account & UPI details used strictly for payment instruction displays and official receipts.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                No Gateways
              </span>
            </div>
          </div>

          {/* Administrative Storage Warning */}
          <div className="p-3.5 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-brand-300 text-xs flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Administrative Confidentiality:</strong> These banking credentials are stored securely in the database and only accessible to authenticated hostel administrators.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Account Holder Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={settingsForm.accountHolderName}
                onChange={(e) => setSettingsForm({ ...settingsForm, accountHolderName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Bank Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={settingsForm.bankName}
                onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Account Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={settingsForm.accountNumber}
                onChange={(e) => setSettingsForm({ ...settingsForm, accountNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                IFSC Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={settingsForm.ifscCode}
                onChange={(e) => setSettingsForm({ ...settingsForm, ifscCode: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono uppercase font-bold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-300 mb-1.5">
                UPI ID (Virtual Payment Address) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <QrCode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. sairamelite@hdfcbank"
                  value={settingsForm.upiId}
                  onChange={(e) => setSettingsForm({ ...settingsForm, upiId: e.target.value.trim() })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-300 mb-1.5">
                Payment Instructions for Residents
              </label>
              <textarea
                rows={3}
                value={settingsForm.paymentInstructions}
                onChange={(e) => setSettingsForm({ ...settingsForm, paymentInstructions: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Payment Information'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 3: REMINDER & POLICY SETTINGS */}
      {activeTab === 'REMINDER' && (
        <form onSubmit={handleSaveSettings} className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-400" />
              <span>Billing Cycle, Reminders & Policies</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure billing schedule defaults, grace period tolerances, late fee penalties, and hostel house rules.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Monthly Due Day (1 - 28) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min="1"
                  max="28"
                  required
                  value={settingsForm.defaultDueDayOfMonth}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultDueDayOfMonth: parseInt(e.target.value, 10) || 5 })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">e.g. 5th of every month</p>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Grace Period (Days) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min="0"
                  max="15"
                  required
                  value={settingsForm.gracePeriodDays}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gracePeriodDays: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Days before late fee applies</p>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Late Fee Penalty / Day (₹) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={settingsForm.lateFeePerDay}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, lateFeePerDay: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Calculated after grace period</p>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-300 mb-1.5">
                Hostel Rules & Regulations
              </label>
              <textarea
                rows={5}
                value={settingsForm.rulesAndRegulations}
                onChange={(e) => setSettingsForm({ ...settingsForm, rulesAndRegulations: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Reminder & Policy Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 4: ACCOUNT & SECURITY */}
      {activeTab === 'ACCOUNT' && (
        <div className="space-y-6">
          {/* Admin Profile Overview */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-brand-400" />
              <span>Administrator Profile</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Admin Name</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{adminUser?.name || 'Administrator'}</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Login Email</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{adminUser?.email || 'admin@sairam.com'}</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Role & Permissions</span>
                <span className="text-sm font-bold text-amber-400 mt-0.5 block">{adminUser?.role || 'SUPER_ADMIN'}</span>
              </div>
            </div>
          </div>

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-sky-400" />
                <span>Change Administrator Password</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Update your login password. Ensure it contains at least 6 characters.
              </p>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  Current Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  New Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>{isSaving ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

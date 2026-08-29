'use client';

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  Search,
  MessageSquare,
  Sparkles,
  Phone,
  Calendar,
  Layers,
  Ban,
  Loader2,
  TestTube,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function RemindersPage() {
  const [mounted, setMounted] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total: 0,
    scheduled: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  });
  const [activeTab, setActiveTab] = useState<'ALL' | 'SENT' | 'PENDING' | 'CANCELLED' | 'FAILED'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Test Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testResidentId, setTestResidentId] = useState('');
  const [testReminderType, setTestReminderType] = useState('FIRST_DUE_REMINDER');
  const [testPhoneOverride, setTestPhoneOverride] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reminders');
      if (!res.ok) throw new Error('Failed to fetch reminder data');
      const data = await res.json();
      setReminders(data.reminders || []);
      setCandidates(data.candidates || []);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerAutomation = async () => {
    try {
      setIsProcessing(true);
      setFeedback(null);
      const res = await fetch('/api/reminders/process', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to process reminders');

      const s = data.summary;
      setFeedback({
        type: 'success',
        message: `Processed ${s.scanned} payments: ${s.firstRemindersSent || 0} D-2 reminders sent, ${s.dueRemindersSent || s.secondRemindersSent || 0} due-date reminders sent, ${s.overdueRemindersSent || 0} overdue reminders sent, ${s.paidCancelled || 0} cancelled (paid), ${s.failedCount || 0} failed.`,
      });
      fetchReminders();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error executing automated reminders engine.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendTestReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testResidentId) {
      setFeedback({ type: 'error', message: 'Please select a resident to test.' });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await fetch('/api/reminders/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: testResidentId,
          reminderType: testReminderType,
          testPhoneOverride: testPhoneOverride || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to send test reminder');

      setTestResult(data);
      setFeedback({
        type: 'success',
        message: `Test WhatsApp reminder sent to ${data.recipient}! Message ID: ${data.result?.messageId || 'Success'}`,
      });
      fetchReminders();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error sending test reminder.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const filteredReminders = reminders.filter((rem) => {
    if (activeTab !== 'ALL' && rem.status !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = rem.resident?.fullName?.toLowerCase().includes(q);
      const phoneMatch = rem.resident?.phone?.includes(q);
      const roomMatch = rem.resident?.room?.roomNumber?.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !roomMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <BellRing className="w-6 h-6 text-amber-400" />
              <span>Automated Payment Reminders</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
              Meta WhatsApp API (IST)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            2-stage automated WhatsApp payment notifications: Due date arrival → 2 days follow-up → Auto-cancelled on payment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchReminders}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Reminders"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setTestResidentId(candidates[0]?.residentId || reminders[0]?.residentId || '');
              setTestResult(null);
              setIsTestModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            <TestTube className="w-4 h-4 text-amber-400" />
            <span>Test WhatsApp Delivery</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleTriggerAutomation}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating Engine...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Run Reminder Engine</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="font-semibold">{feedback.message}</span>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Tracked</div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {isLoading ? <div className="h-8 w-14 bg-slate-800 rounded-lg animate-pulse mt-1" /> : summary.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Lifecycle notifications</div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Sent Reminders</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
            {isLoading ? <div className="h-8 w-14 bg-slate-800 rounded-lg animate-pulse mt-1" /> : summary.sent}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Dispatched via WhatsApp</div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Auto-Cancelled</div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400 mt-1">
            {isLoading ? <div className="h-8 w-14 bg-slate-800 rounded-lg animate-pulse mt-1" /> : summary.cancelled || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Paid before follow-up</div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Due Candidates</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
            {isLoading ? <div className="h-8 w-14 bg-slate-800 rounded-lg animate-pulse mt-1" /> : candidates.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Unpaid active dues</div>
        </div>
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {(['ALL', 'SENT', 'PENDING', 'CANCELLED', 'FAILED'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search resident, room, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* 4. Reminders List Table */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Reminder History & WhatsApp Delivery Log</h2>
            <p className="text-[11px] text-slate-400">Strictly recorded per payment stage</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {filteredReminders.length} entries
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-950/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="py-12 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <BellRing className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-300">No reminders matching current filter</h3>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Automated reminders will be generated as resident due dates arrive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Resident & Room</th>
                  <th className="p-3">Billing Month</th>
                  <th className="p-3">Amount Due</th>
                  <th className="p-3">Stage / Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Sent / Scheduled Date</th>
                  <th className="p-3">WhatsApp Message ID / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredReminders.map((rem: any) => (
                  <tr key={rem.id} className="hover:bg-slate-800/20">
                    <td className="p-3">
                      <div className="font-bold text-white">{rem.resident?.fullName || 'Resident'}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>Room {rem.resident?.room?.roomNumber || rem.monthlyPayment?.room?.roomNumber || 'N/A'}</span>
                        <span>•</span>
                        <span className="font-mono">{rem.resident?.phone}</span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-300">
                      {rem.monthlyPayment?.billingMonth || 'N/A'}
                    </td>
                    <td className="p-3 font-bold text-amber-400">
                      {rem.monthlyPayment?.totalAmountDue !== undefined
                        ? `₹${Number(rem.monthlyPayment.totalAmountDue).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-amber-300">
                        {rem.reminderType === 'FIRST_DUE_REMINDER'
                          ? '1st Due Date Reminder'
                          : rem.reminderType === 'SECOND_REMINDER'
                          ? '2nd Follow-up (+2 Days)'
                          : rem.reminderType}
                      </span>
                    </td>
                    <td className="p-3">
                      {rem.status === 'SENT' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                          Sent
                        </span>
                      ) : rem.status === 'CANCELLED' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-bold uppercase">
                          Cancelled (Paid)
                        </span>
                      ) : rem.status === 'FAILED' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase">
                          Failed
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400">
                      {rem.sentAt ? (
                        <div>
                          <div className="text-white font-medium">{formatDate(rem.sentAt)}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(rem.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>Scheduled: {formatDate(rem.scheduledFor)}</div>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {rem.providerMessageId ? (
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[160px]" title={rem.providerMessageId}>
                          {rem.providerMessageId}
                        </div>
                      ) : rem.failureReason ? (
                        <div className="text-[11px] text-rose-400 max-w-[180px] truncate" title={rem.failureReason}>
                          {rem.failureReason}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test WhatsApp Reminder Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => !isTesting && setIsTestModalOpen(false)}
        title="Send Test WhatsApp Reminder"
        subtitle="Trigger a single WhatsApp reminder for testing without altering automated production schedules."
      >
        <form onSubmit={handleSendTestReminder} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-300">
              Select Resident <span className="text-amber-400">*</span>
            </label>
            <select
              required
              value={testResidentId}
              onChange={(e) => setTestResidentId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-white font-semibold"
            >
              <option value="">-- Choose Resident --</option>
              {candidates.map((c) => (
                <option key={c.residentId} value={c.residentId}>
                  {c.residentName} (Room {c.roomNumber}) - Due: ₹{Number(c.amountDue).toLocaleString('en-IN')}
                </option>
              ))}
              {reminders.map((r) => (
                <option key={r.residentId} value={r.residentId}>
                  {r.resident?.fullName} (Room {r.resident?.room?.roomNumber || 'N/A'}) - Phone: {r.resident?.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-300">
              Reminder Stage <span className="text-amber-400">*</span>
            </label>
            <select
              value={testReminderType}
              onChange={(e) => setTestReminderType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-white font-semibold"
            >
              <option value="FIRST_DUE_REMINDER">1st Due Date Reminder (Due Today)</option>
              <option value="SECOND_REMINDER">2nd Follow-up Reminder (Still Pending)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-300">
              Override Recipient Phone Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 8688535143 or +918688535143"
              value={testPhoneOverride}
              onChange={(e) => setTestPhoneOverride(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-white font-mono"
            />
            <p className="text-[10px] text-slate-500">
              Leave blank to send to the resident&apos;s registered mobile number.
            </p>
          </div>

          {testResult && (
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dispatched Successfully!</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-pre-line font-mono bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                {testResult.renderedText}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => setIsTestModalOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isTesting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send WhatsApp Message</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

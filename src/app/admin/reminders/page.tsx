'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Search,
  Filter,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Sparkles,
  Edit2,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  Phone,
  MessageSquare,
  Building,
  ShieldCheck,
  AlertCircle,
  Play,
  RotateCcw,
  Check,
  Info,
  Loader2,
  TestTube,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';
import { formatDate } from '@/lib/dateUtils';

export default function AdminRemindersPage() {
  const [activeTab, setActiveTab] = useState<'CANDIDATES' | 'SCHEDULED' | 'SENT' | 'FAILED' | 'TEMPLATES'>('CANDIDATES');
  const [reminders, setReminders] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Manual Send / Test Modal State
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState('FIRST_DUE_REMINDER');
  const [customScheduleDate, setCustomScheduleDate] = useState('');
  const [testPhoneOverride, setTestPhoneOverride] = useState('');

  // Edit Template Modal State
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    templateBody: '',
    channel: 'WHATSAPP',
    daysOffset: 0,
    isActive: true,
  });

  // View Reminder Message Modal State
  const [viewMessageModalOpen, setViewMessageModalOpen] = useState(false);
  const [inspectedReminder, setInspectedReminder] = useState<any>(null);

  // Schedule Timeline Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [inspectedSchedule, setInspectedSchedule] = useState<any>(null);

  // Feedback State
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [remindersRes, templatesRes] = await Promise.all([
        fetch('/api/reminders'),
        fetch('/api/reminders/templates'),
      ]);

      const dataReminders = await remindersRes.json();
      const dataTemplates = await templatesRes.json();

      if (dataReminders.reminders) {
        setReminders(dataReminders.reminders);
        setCandidates(dataReminders.candidates || []);
        setSummary(dataReminders.summary || {});
      }
      if (dataTemplates.templates) {
        setTemplates(dataTemplates.templates);
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAutomation = async () => {
    try {
      setIsProcessing(true);
      setActionError(null);
      const res = await fetch('/api/reminders/process', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to execute reminders');

      const s = data.summary;
      setActionSuccess(
        `Automated engine evaluated ${s.scanned} records: ${s.firstRemindersSent} 1st reminders sent, ${s.secondRemindersSent} 2nd reminders sent, ${s.paidCancelled} cancelled (paid), ${s.failedCount} failed.`
      );
      setTimeout(() => setActionSuccess(null), 6000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Execution error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Send Reminder Modal for Candidate
  const handleOpenSendModal = (candidate: any, defaultType?: string) => {
    setSelectedCandidate(candidate);
    setSelectedTemplateType(defaultType || 'FIRST_DUE_REMINDER');
    setCustomScheduleDate('');
    setTestPhoneOverride('');
    setActionError(null);
    setSendModalOpen(true);
  };

  // Open Edit Template Modal
  const handleOpenEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateForm({
      title: template.title,
      templateBody: template.templateBody,
      channel: template.channel,
      daysOffset: template.daysOffset,
      isActive: template.isActive,
    });
    setActionError(null);
    setEditTemplateModalOpen(true);
  };

  // Submit Test / Direct Reminder Dispatch
  const handleSendReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/reminders/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: selectedCandidate.residentId,
          monthlyPaymentId: selectedCandidate.paymentId,
          reminderType: selectedTemplateType,
          testPhoneOverride: testPhoneOverride || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to dispatch reminder');
      }

      setSendModalOpen(false);
      setActionSuccess(`WhatsApp reminder successfully sent to ${data.recipient}!`);
      setTimeout(() => setActionSuccess(null), 4500);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to dispatch reminder');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Template
  const handleSaveTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/reminders/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderType: editingTemplate.reminderType,
          ...templateForm,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update template');
      }

      setEditTemplateModalOpen(false);
      setActionSuccess(`Template "${editingTemplate.title}" updated.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Retry or Cancel
  const handleReminderAction = async (reminderId: string, action: 'RETRY' | 'CANCEL' | 'MARK_FAILED') => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error('Failed to perform reminder action');

      setActionSuccess(`Reminder marked as ${action === 'RETRY' ? 'SENT' : action}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    }
  };

  // Computed Lists
  const scheduledReminders = reminders.filter((r) => r.status === 'SCHEDULED' || r.status === 'PENDING');
  const sentReminders = reminders.filter((r) => r.status === 'SENT');
  const failedReminders = reminders.filter((r) => r.status === 'FAILED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Payment Reminder Infrastructure</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-emerald-400" />
              <span>Meta WhatsApp Cloud API</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated candidate detection, Meta Cloud API message dispatches, and delivery tracking for rent collection reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 text-brand-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleRunAutomation}
            disabled={isProcessing}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Run Automated Reminder Engine</span>
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Soon / Candidates</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white">
              {isLoading ? <div className="h-7 w-12 bg-slate-800 rounded-lg animate-pulse mt-1" /> : candidates.length}
            </span>
            <span className="text-[11px] text-amber-400 font-semibold">Unpaid Dues</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Requiring reminder notices</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled & Queued</p>
          <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1">
            {isLoading ? <div className="h-7 w-12 bg-slate-800 rounded-lg animate-pulse mt-1" /> : (summary.scheduled || scheduledReminders.length)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Pending automated dispatch</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sent Dispatches</p>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            {isLoading ? <div className="h-7 w-12 bg-slate-800 rounded-lg animate-pulse mt-1" /> : (summary.sent || sentReminders.length)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Documented in history</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failed Attempts</p>
          <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
            {isLoading ? <div className="h-7 w-12 bg-slate-800 rounded-lg animate-pulse mt-1" /> : (summary.failed || failedReminders.length)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Requiring review</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('CANDIDATES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'CANDIDATES'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>1. Due Candidates ({candidates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SCHEDULED')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'SCHEDULED'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>2. Scheduled Queue ({scheduledReminders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SENT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'SENT'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>3. Sent History ({sentReminders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('FAILED')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'FAILED'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <XCircle className="w-4 h-4" />
          <span>4. Failed Dispatches ({failedReminders.length})</span>
        </button>
      </div>

      {/* TAB 1: CANDIDATES */}
      {activeTab === 'CANDIDATES' && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Pending & Overdue Resident Dues</span>
            </h3>
            <span className="text-xs text-slate-400">{candidates.length} candidates detected</span>
          </div>

          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading reminder candidates...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              No unpaid dues requiring immediate reminders.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room</th>
                    <th className="py-3.5 px-4 font-bold">Billing Month</th>
                    <th className="py-3.5 px-4 font-bold">Amount Due</th>
                    <th className="py-3.5 px-4 font-bold">Due Date</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {candidates.map((c) => (
                    <tr key={c.paymentId} className="hover:bg-slate-800/30">
                      <td className="py-4 px-4 font-bold text-white">
                        <div>{c.residentName}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.phone}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-brand-400 font-bold">Room {c.roomNumber}</td>
                      <td className="py-4 px-4 text-slate-300 font-semibold">{c.billingMonth}</td>
                      <td className="py-4 px-4 text-amber-400 font-bold">₹{c.amountDue.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4 text-slate-400">
                        {formatDate(c.dueDate)}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.category === 'OVERDUE'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {c.category === 'OVERDUE' ? 'OVERDUE' : 'DUE SOON'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setInspectedSchedule(c);
                              setScheduleModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs inline-flex items-center gap-1 border border-slate-700"
                            title="View Exact Reminder Timeline"
                          >
                            <Calendar className="w-3.5 h-3.5 text-sky-400" />
                            <span>Schedule</span>
                          </button>
                          <button
                            onClick={() => handleOpenSendModal(c)}
                            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Test</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCHEDULED */}
      {activeTab === 'SCHEDULED' && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Queued & Scheduled Payment Reminders</span>
            </h3>
          </div>

          {scheduledReminders.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              No reminders currently scheduled in the queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room</th>
                    <th className="py-3.5 px-4 font-bold">Reminder Type</th>
                    <th className="py-3.5 px-4 font-bold">Scheduled Date</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {scheduledReminders.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-4 px-4 font-bold text-white">{r.resident?.fullName}</td>
                      <td className="py-4 px-4 font-mono text-brand-400 font-bold">Room {r.resident?.room?.roomNumber || 'N/A'}</td>
                      <td className="py-4 px-4 text-slate-300 font-semibold">{r.reminderType}</td>
                      <td className="py-4 px-4 text-slate-400">
                        {formatDate(r.scheduledFor)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold text-[10px]">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => {
                            setInspectedReminder(r);
                            setViewMessageModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                          title="Preview Message"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SENT */}
      {activeTab === 'SENT' && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Reminder Dispatch History</span>
            </h3>
          </div>

          {sentReminders.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              No reminders dispatched yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room</th>
                    <th className="py-3.5 px-4 font-bold">Reminder Type</th>
                    <th className="py-3.5 px-4 font-bold">Sent Date & Time</th>
                    <th className="py-3.5 px-4 font-bold">WhatsApp Message ID</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sentReminders.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-4 px-4 font-bold text-white">{r.resident?.fullName}</td>
                      <td className="py-4 px-4 font-mono text-brand-400 font-bold">Room {r.resident?.room?.roomNumber || 'N/A'}</td>
                      <td className="py-4 px-4 text-slate-300 font-semibold">{r.reminderType}</td>
                      <td className="py-4 px-4 text-slate-400">
                        {r.sentAt ? new Date(r.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                        {r.providerMessageId || '—'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                          SENT
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => {
                            setInspectedReminder(r);
                            setViewMessageModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FAILED */}
      {activeTab === 'FAILED' && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span>Failed Reminder Dispatches</span>
            </h3>
          </div>

          {failedReminders.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              No failed reminder dispatches. All deliveries operating smoothly.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room</th>
                    <th className="py-3.5 px-4 font-bold">Failure Reason</th>
                    <th className="py-3.5 px-4 font-bold">Attempts</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {failedReminders.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-4 px-4 font-bold text-white">{r.resident?.fullName}</td>
                      <td className="py-4 px-4 font-mono text-brand-400 font-bold">Room {r.resident?.room?.roomNumber || 'N/A'}</td>
                      <td className="py-4 px-4 text-rose-400 font-medium">{r.failureReason || 'Dispatch timeout'}</td>
                      <td className="py-4 px-4 text-slate-400">{r.attemptCount} attempt(s)</td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleReminderAction(r.id, 'RETRY')}
                          className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MANUAL TEST REMINDER MODAL */}
      <Modal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Send Test WhatsApp Payment Reminder"
        subtitle={`Dispatch a live WhatsApp test reminder for ${selectedCandidate?.residentName || 'Resident'}`}
        maxWidth="md"
      >
        <form onSubmit={handleSendReminderSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Resident:</span>
              <span className="font-bold text-white">{selectedCandidate?.residentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assigned Room:</span>
              <span className="font-bold text-brand-400">Room {selectedCandidate?.roomNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount Due:</span>
              <span className="font-extrabold text-amber-400">₹{Number(selectedCandidate?.amountDue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Registered Phone:</span>
              <span className="font-mono text-slate-200">{selectedCandidate?.phone}</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reminder Stage</label>
            <select
              value={selectedTemplateType}
              onChange={(e) => setSelectedTemplateType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold"
            >
              <option value="FIRST_DUE_REMINDER">Sequence 1: D-2 First Reminder (Due in 2 days)</option>
              <option value="DUE_DATE_REMINDER">Sequence 2: Due Date Reminder (Due today)</option>
              <option value="OVERDUE_REMINDER">Sequence 3+: Overdue Reminder (Still pending / overdue)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Override Recipient Phone Number (Optional)</label>
            <input
              type="text"
              placeholder="e.g. +918688535143"
              value={testPhoneOverride}
              onChange={(e) => setTestPhoneOverride(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Leave empty to dispatch to the resident&apos;s registered phone.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setSendModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send WhatsApp Message</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* SCHEDULE INSPECTOR MODAL */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Recurring Payment Reminder Schedule"
        subtitle={`Automated timeline for ${inspectedSchedule?.residentName || 'Resident'} (Room ${inspectedSchedule?.roomNumber || ''})`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Due Date:</span>
              <span className="font-bold text-amber-400">
                {formatDate(inspectedSchedule?.dueDate, 'N/A')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Monthly Rent:</span>
              <span className="font-bold text-white">₹{Number(inspectedSchedule?.amountDue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="font-bold text-emerald-400">
                {inspectedSchedule?.scheduleStatus || 'Continues every 2 days until payment'}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-slate-300 font-bold mb-2">Automated Reminder Sequence</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(inspectedSchedule?.reminderSchedule || []).map((s: any) => (
                <div
                  key={s.sequence}
                  className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-bold flex items-center justify-center">
                      {s.sequence}
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        {formatDate(s.scheduledFor)}
                      </div>
                      <div className="text-[10px] text-slate-400">{s.label}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    IST
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-sky-400" />
            <span>Reminders continue every 2 days indefinitely until verified as PAID.</span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setScheduleModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* VIEW MESSAGE MODAL */}
      <Modal
        isOpen={viewMessageModalOpen}
        onClose={() => setViewMessageModalOpen(false)}
        title="WhatsApp Message Content"
        subtitle={`Recorded dispatch payload for ${inspectedReminder?.resident?.fullName || 'Resident'}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 whitespace-pre-line font-mono text-slate-200">
            {inspectedReminder?.messageText || 'No message text recorded.'}
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setViewMessageModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

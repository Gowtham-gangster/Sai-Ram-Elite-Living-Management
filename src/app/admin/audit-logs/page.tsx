'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Clock,
  UserCheck,
  Building,
  CreditCard,
  Key,
  Users,
  Bell,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
  Lock,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Detail Inspection Modal
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/audit-logs?limit=250');
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const processedLogs = useMemo(() => {
    return logs.filter((log) => {
      if (entityFilter !== 'ALL' && log.entityType !== entityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchAction = log.action?.toLowerCase().includes(q);
        const matchUser = log.adminName?.toLowerCase().includes(q);
        const matchEntity = log.entityType?.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        if (!matchAction && !matchUser && !matchEntity && !matchDetails) return false;
      }
      return true;
    });
  }, [logs, entityFilter, search]);

  const totalPages = Math.ceil(processedLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedLogs.slice(start, start + pageSize);
  }, [processedLogs, currentPage, pageSize]);

  const handleOpenDetail = (log: any) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  // Helper to render parsed JSON details
  const renderDetails = (detailsStr: string | null) => {
    if (!detailsStr) return 'No additional metadata logged.';
    try {
      const parsed = JSON.parse(detailsStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return detailsStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Administrative Audit Trail</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Immutable Ledger (Read-Only)</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Permanent, tamper-proof activity logs documenting all administrative transactions, room updates, and setting alterations.
          </p>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search action, admin user, entity, or change details..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Entity Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="ALL">All Entities</option>
              <option value="RESIDENT">Resident Operations</option>
              <option value="ROOM">Room Operations</option>
              <option value="PAYMENT">Payment & Billing</option>
              <option value="SETTING">System Settings</option>
              <option value="REMINDER">Reminders</option>
              <option value="AUTH">Authentication</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading immutable audit trail...</p>
          </div>
        ) : processedLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No audit records found</h3>
            <p className="text-xs text-slate-400 mt-1">No administrative events match your search.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Timestamp</th>
                    <th className="py-3.5 px-4 font-bold">Admin User</th>
                    <th className="py-3.5 px-4 font-bold">Action Performed</th>
                    <th className="py-3.5 px-4 font-bold">Target Entity</th>
                    <th className="py-3.5 px-4 font-bold">Summary Details</th>
                    <th className="py-3.5 px-4 font-bold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Timestamp */}
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      {/* Admin User */}
                      <td className="py-4 px-4 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                          <span>{log.adminName || 'System'}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 font-mono font-bold text-[10px] border border-slate-700">
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-300 text-[11px]">
                          {log.entityType}
                        </span>
                      </td>

                      {/* Summary Details */}
                      <td className="py-4 px-4 text-slate-400 max-w-sm truncate text-[11px]">
                        {log.details || 'No additional details.'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(log)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="Inspect Structured Audit Payload"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="text-slate-400">
                Showing{' '}
                <strong className="text-white">
                  {(currentPage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-white">
                  {Math.min(currentPage * pageSize, processedLogs.length)}
                </strong>{' '}
                of <strong className="text-white">{processedLogs.length}</strong> immutable audit records
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                  >
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-semibold text-slate-300">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AUDIT LOG INSPECTION MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Audit Record: ${selectedLog?.action}`}
        subtitle={`Entity: ${selectedLog?.entityType} • Log ID: ${selectedLog?.id}`}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 text-slate-300">
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Authorized By</span>
                <span className="font-bold text-white text-sm">{selectedLog.adminName || 'System'}</span>
                {selectedLog.adminUser?.email && (
                  <span className="text-[10px] text-slate-400 block">{selectedLog.adminUser.email}</span>
                )}
              </div>

              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Logged Timestamp</span>
                <span className="font-mono text-white text-xs block">
                  {new Date(selectedLog.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="text-[10px] text-slate-500 block">IP: {selectedLog.ipAddress || 'Internal/Loopback'}</span>
              </div>
            </div>

            {/* Structured Details */}
            <div>
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-1.5">
                Structured Change Details / Payload:
              </h4>
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {renderDetails(selectedLog.details)}
              </pre>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span>This record is permanently sealed in the database audit log. Modifications are prohibited by system policy.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

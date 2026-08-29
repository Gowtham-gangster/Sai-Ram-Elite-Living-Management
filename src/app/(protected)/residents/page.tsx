'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Search,
  Phone,
  DoorOpen,
  Calendar,
  CreditCard,
  Edit2,
  UserX,
  AlertCircle,
  Eye,
  ArrowUpDown,
  Building,
  CheckCircle2,
  ArrowRightLeft,
  Clock,
  IndianRupee,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge, StatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { formatSharingType } from '@/lib/formatters';
import { formatDate } from '@/lib/dateUtils';

export default function ResidentsPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const [residents, setResidents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  // Search, Filters & Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [occupationFilter, setOccupationFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'fullName' | 'roomNumber' | 'checkInDate' | 'monthlyRent' | 'status'>('checkInDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Add / Edit Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<any>(null);

  // Room Change Modal State
  const [isRoomChangeOpen, setIsRoomChangeOpen] = useState(false);
  const [residentToMove, setResidentToMove] = useState<any>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [roomChangeReason, setRoomChangeReason] = useState('');

  // Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [residentToCheckout, setResidentToCheckout] = useState<any>(null);
  const [checkoutData, setCheckoutData] = useState({
    checkOutDate: new Date().toISOString().split('T')[0],
    reason: 'Normal Checkout',
    refundDepositAmount: 0,
    deductionsAmount: 0,
    notes: '',
  });

  // Add Resident Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    idProofType: 'Aadhaar Card',
    idProofNumber: '',
    occupation: 'Student',
    companyOrCollegeName: '',
    roomId: '',
    checkInDate: new Date().toISOString().split('T')[0],
    expectedCheckoutDate: '',
    monthlyRent: 0,
    securityDeposit: '',
    declarationAccepted: true,
    notes: '',
  });

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
      const [resResidents, resRooms] = await Promise.all([
        fetch('/api/residents'),
        fetch('/api/rooms'),
      ]);

      const dataResidents = await resResidents.json();
      const dataRooms = await resRooms.json();

      if (dataResidents.residents) {
        setResidents(dataResidents.residents);
      }
      if (dataRooms.rooms) {
        setRooms(dataRooms.rooms);
      }
    } catch (err) {
      console.error('Failed to load resident directory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Available Rooms with Slots
  const availableRoomsList = useMemo(() => {
    return rooms.filter((rm) => {
      const activeCount = rm.occupancyCount ?? (rm.residents?.length || 0);
      return rm.status !== 'MAINTENANCE' && activeCount < rm.capacity;
    });
  }, [rooms]);

  // Processed Filtered & Sorted Residents
  const processedResidents = useMemo(() => {
    return residents
      .filter((res) => {
        // Search
        if (search) {
          const q = search.toLowerCase();
          const matchesName = res.fullName?.toLowerCase().includes(q);
          const matchesPhone = res.phone?.includes(q);
          const matchesRoom = res.room?.roomNumber?.toLowerCase().includes(q);
          const matchesOrg = (res.companyOrCollegeName || res.address || '').toLowerCase().includes(q);
          if (!matchesName && !matchesPhone && !matchesRoom && !matchesOrg) return false;
        }

        // Status filter
        if (statusFilter !== 'ALL') {
          const status = (res.status || '').toUpperCase();
          if (statusFilter === 'ACTIVE' && status !== 'ACTIVE') return false;
          if (statusFilter === 'NOTICE_PERIOD' && status !== 'NOTICE_PERIOD') return false;
          if (statusFilter === 'CHECKED_OUT' && status !== 'VACATED' && status !== 'CHECKED OUT' && status !== 'CHECKED_OUT') return false;
        }

        // Room filter
        if (roomFilter !== 'ALL' && res.roomId !== roomFilter) {
          return false;
        }

        // Occupation filter
        if (occupationFilter !== 'ALL') {
          const occ = (res.occupation || '').toUpperCase();
          if (occupationFilter === 'STUDENT' && !occ.includes('STUDENT')) return false;
          if (occupationFilter === 'WORKING' && (!occ.includes('PROFESSIONAL') && !occ.includes('WORKING'))) return false;
        }

        // Payment status filter
        if (paymentFilter !== 'ALL') {
          const latestPayment = res.monthlyPayments?.[0]?.status || 'PENDING';
          if (paymentFilter !== latestPayment) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'roomNumber') {
          valA = a.room?.roomNumber || '';
          valB = b.room?.roomNumber || '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [residents, search, statusFilter, roomFilter, occupationFilter, paymentFilter, sortField, sortOrder]);

  // Paginated Slices
  const totalPages = Math.ceil(processedResidents.length / pageSize) || 1;
  const paginatedResidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedResidents.slice(start, start + pageSize);
  }, [processedResidents, currentPage, pageSize]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const openAddModal = () => {
    const firstAvailable = availableRoomsList[0];
    setFormData({
      fullName: '',
      phone: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      idProofType: 'Aadhaar Card',
      idProofNumber: '',
      occupation: 'Student',
      companyOrCollegeName: '',
      roomId: firstAvailable?.id || '',
      checkInDate: new Date().toISOString().split('T')[0],
      expectedCheckoutDate: '',
      monthlyRent: 8000,
      securityDeposit: '',
      declarationAccepted: true,
      notes: '',
    });
    setActionError(null);
    setIsAddModalOpen(true);
  };

  const handleRoomSelect = (roomId: string) => {
    setFormData((prev) => ({
      ...prev,
      roomId,
    }));
  };

  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!formData.fullName.trim()) {
      setActionError('Resident full name is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setActionError('Valid mobile number is required.');
      return;
    }
    if (!formData.roomId) {
      setActionError('Please select a room.');
      return;
    }

    // Room capacity check
    const targetRoom = rooms.find((r) => r.id === formData.roomId);
    if (targetRoom) {
      const activeCount = targetRoom.occupancyCount ?? (targetRoom.residents?.length || 0);
      if (activeCount >= targetRoom.capacity) {
        setActionError(`Room ${targetRoom.roomNumber} is currently full.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          address: formData.companyOrCollegeName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to onboard resident.');
      }

      setActionSuccess(`Resident ${formData.fullName} admitted to Room ${targetRoom?.roomNumber} successfully!`);
      setIsAddModalOpen(false);
      fetchData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openRoomChangeModal = (res: any) => {
    setResidentToMove(res);
    setTargetRoomId('');
    setRoomChangeReason('');
    setActionError(null);
    setIsRoomChangeOpen(true);
  };

  const handleExecuteRoomChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoomId) {
      setActionError('Please select a target room.');
      return;
    }

    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    if (targetRoom) {
      const activeCount = targetRoom.occupancyCount ?? (targetRoom.residents?.length || 0);
      if (activeCount >= targetRoom.capacity) {
        setActionError(`Room ${targetRoom.roomNumber} is full. Cannot transfer resident.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/residents/${residentToMove.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_ROOM',
          newRoomId: targetRoomId,
          notes: roomChangeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transfer resident.');
      }

      setActionSuccess(data.message || 'Room change completed successfully.');
      setIsRoomChangeOpen(false);
      fetchData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openCheckoutModal = (res: any) => {
    setResidentToCheckout(res);
    setCheckoutData({
      checkOutDate: new Date().toISOString().split('T')[0],
      reason: 'Normal Checkout',
      refundDepositAmount:
        typeof res.securityDeposit === 'string' && !isNaN(parseFloat(res.securityDeposit))
          ? parseFloat(res.securityDeposit)
          : 0,
      deductionsAmount: 0,
      notes: '',
    });
    setActionError(null);
    setIsCheckoutModalOpen(true);
  };

  const handleExecuteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/residents/${residentToCheckout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECKOUT',
          ...checkoutData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete checkout.');
      }

      setActionSuccess(`${residentToCheckout.fullName} checked out successfully. Room capacity updated.`);
      setIsCheckoutModalOpen(false);
      fetchData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-amber-400" />
            <span>Residents Directory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage active residents, room allocations, Google Form KYC details, and status lifecycles.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Resident</span>
        </button>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold">{actionError}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search name, phone, room..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium cursor-pointer"
          >
            <option value="ALL">All Resident Statuses</option>
            <option value="ACTIVE">Active Residents</option>
            <option value="NOTICE_PERIOD">Notice Period</option>
            <option value="CHECKED_OUT">Checked Out</option>
          </select>

          {/* Room Filter */}
          <select
            value={roomFilter}
            onChange={(e) => {
              setRoomFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium cursor-pointer"
          >
            <option value="ALL">All Rooms</option>
            {rooms.map((rm) => (
              <option key={rm.id} value={rm.id}>
                Room {rm.roomNumber} ({formatSharingType(rm.sharingType)})
              </option>
            ))}
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium cursor-pointer"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
      </div>

      {/* Main Resident Table */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span>Loading resident directory...</span>
        </div>
      ) : paginatedResidents.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-amber-400">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-white">
            {search || statusFilter !== 'ALL' || roomFilter !== 'ALL'
              ? 'No residents match your search'
              : 'No residents found'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL' || roomFilter !== 'ALL'
              ? 'Try clearing your search query or filters.'
              : 'Click "Add New Resident" to enroll your first hostel resident.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th
                      className="p-4 cursor-pointer hover:text-slate-200 select-none"
                      onClick={() => handleSort('fullName')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Resident Name</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-4">Mobile Number</th>
                    <th
                      className="p-4 cursor-pointer hover:text-slate-200 select-none"
                      onClick={() => handleSort('roomNumber')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Room</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-4">Occupation</th>
                    <th className="p-4">Company / College</th>
                    <th
                      className="p-4 cursor-pointer hover:text-slate-200 select-none"
                      onClick={() => handleSort('checkInDate')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Check-in</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="p-4 cursor-pointer hover:text-slate-200 select-none"
                      onClick={() => handleSort('monthlyRent')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Monthly Rent</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-4">Payment Status</th>
                    <th
                      className="p-4 cursor-pointer hover:text-slate-200 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {paginatedResidents.map((res) => {
                    const latestPayment = res.monthlyPayments?.[0];
                    const isCheckedOut = res.status === 'VACATED' || res.status === 'CHECKED OUT';

                    return (
                      <tr
                        key={res.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/residents/${res.id}`)}
                      >
                        <td className="p-4 font-bold text-white flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-extrabold text-xs">
                            {res.fullName?.charAt(0) || 'R'}
                          </div>
                          <div>
                            <span className="hover:text-amber-400 transition-colors">
                              {res.fullName}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 font-medium">{res.phone}</td>
                        <td className="p-4 font-bold text-amber-400">
                          Room {res.room?.roomNumber || 'N/A'}
                        </td>
                        <td className="p-4 text-slate-300">
                          {res.occupation || 'Student'}
                        </td>
                        <td className="p-4 text-slate-400 text-[11px] truncate max-w-[140px]">
                          {res.companyOrCollegeName || res.address || '—'}
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {formatDate(res.checkInDate)}
                        </td>
                        <td className="p-4 font-bold text-white">
                          ₹{Number(res.monthlyRent).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4">
                          {latestPayment ? (
                            <PaymentStatusBadge status={latestPayment.status} />
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">
                              Not generated
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={res.status} />
                        </td>
                        <td
                          className="p-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => router.push(`/residents/${res.id}`)}
                              title="View Resident Profile"
                              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {!isCheckedOut && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openRoomChangeModal(res)}
                                  title="Transfer Room"
                                  className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-xl transition-all"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCheckoutModal(res)}
                                  title="Check Out Resident"
                                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 text-xs text-slate-400">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, processedResidents.length)} of{' '}
                {processedResidents.length} residents
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-bold text-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Resident Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSaving && setIsAddModalOpen(false)}
        title="Add New Resident"
        subtitle="Admit resident to a room matching Google Form intake fields."
      >
        <form onSubmit={handleCreateResident} className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Full Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Mobile Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Father&apos;s / Guardian&apos;s Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rajesh Sharma"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Emergency Contact Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876500000"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Aadhaar Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="12-digit Aadhaar Number"
                value={formData.idProofNumber}
                onChange={(e) => setFormData({ ...formData, idProofNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Occupation <span className="text-amber-400">*</span>
              </label>
              <select
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
              >
                <option value="Student">Student</option>
                <option value="Working Professional">Working Professional</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Company or College Name <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SRM University / Infosys"
              value={formData.companyOrCollegeName}
              onChange={(e) => setFormData({ ...formData, companyOrCollegeName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* Room Selection with Capacity Indicator */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Room Assignment <span className="text-amber-400">*</span>
            </label>
            <select
              required
              value={formData.roomId}
              onChange={(e) => handleRoomSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
            >
              <option value="">-- Select an Available Room --</option>
              {rooms.map((rm) => {
                const occupants = rm.occupancyCount ?? (rm.residents?.length || 0);
                const available = Math.max(0, rm.capacity - occupants);
                const isFull = available === 0;

                return (
                  <option
                    key={rm.id}
                    value={rm.id}
                    disabled={isFull || rm.status === 'MAINTENANCE'}
                  >
                    Room {rm.roomNumber} - {formatSharingType(rm.sharingType)} ({occupants}/
                    {rm.capacity} Occupied {isFull ? '• FULL' : `• ${available} Space Available`})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Check-in Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.checkInDate}
                onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Security Deposit <span className="text-[10px] text-slate-400 font-normal">(Intake / Note)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 2000, Yes, Paid"
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Monthly Rent (₹/mo)
              </label>
              <input
                type="number"
                min={0}
                value={formData.monthlyRent}
                onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any operational or dietary notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="decl"
              checked={formData.declarationAccepted}
              onChange={(e) => setFormData({ ...formData, declarationAccepted: e.target.checked })}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500"
            />
            <label htmlFor="decl" className="text-xs text-slate-400 cursor-pointer">
              Resident declaration and hostel rules accepted
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
              <span>Admit Resident</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Room Change Modal */}
      <Modal
        isOpen={isRoomChangeOpen}
        onClose={() => !isSaving && setIsRoomChangeOpen(false)}
        title={`Transfer ${residentToMove?.fullName || 'Resident'}`}
        subtitle={`Current Room: Room ${residentToMove?.room?.roomNumber || 'N/A'}`}
      >
        <form onSubmit={handleExecuteRoomChange} className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Select Target Room <span className="text-amber-400">*</span>
            </label>
            <select
              required
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
            >
              <option value="">-- Choose New Room --</option>
              {rooms
                .filter((r) => r.id !== residentToMove?.roomId)
                .map((rm) => {
                  const occupants = rm.occupancyCount ?? (rm.residents?.length || 0);
                  const available = Math.max(0, rm.capacity - occupants);
                  const isFull = available === 0;

                  return (
                    <option
                      key={rm.id}
                      value={rm.id}
                      disabled={isFull || rm.status === 'MAINTENANCE'}
                    >
                      Room {rm.roomNumber} - {formatSharingType(rm.sharingType)} ({occupants}/
                      {rm.capacity} Occupied {isFull ? '• FULL' : `• ${available} Space Available`})
                    </option>
                  );
                })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Reason / Remarks for Room Change
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Resident requested AC upgrade or floor change..."
              value={roomChangeReason}
              onChange={(e) => setRoomChangeReason(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsRoomChangeOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
              <span>Confirm Room Transfer</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Controlled Checkout Modal */}
      <Modal
        isOpen={isCheckoutModalOpen}
        onClose={() => !isSaving && setIsCheckoutModalOpen(false)}
        title={`Check Out ${residentToCheckout?.fullName || 'Resident'}`}
        subtitle={`Vacate Room ${residentToCheckout?.room?.roomNumber || 'N/A'}. Historical records will be preserved.`}
      >
        <form onSubmit={handleExecuteCheckout} className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Checkout Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                required
                value={checkoutData.checkOutDate}
                onChange={(e) => setCheckoutData({ ...checkoutData, checkOutDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Checkout Reason
              </label>
              <input
                type="text"
                value={checkoutData.reason}
                onChange={(e) => setCheckoutData({ ...checkoutData, reason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Deposit Refund (₹)
              </label>
              <input
                type="number"
                min={0}
                value={checkoutData.refundDepositAmount}
                onChange={(e) => setCheckoutData({ ...checkoutData, refundDepositAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Deductions / Damage Charges (₹)
              </label>
              <input
                type="number"
                min={0}
                value={checkoutData.deductionsAmount}
                onChange={(e) => setCheckoutData({ ...checkoutData, deductionsAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Checkout Remarks / Clearance Notes
            </label>
            <textarea
              rows={2}
              placeholder="Key returned, room inspection completed..."
              value={checkoutData.notes}
              onChange={(e) => setCheckoutData({ ...checkoutData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsCheckoutModalOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : null}
              <span>Confirm Resident Checkout</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

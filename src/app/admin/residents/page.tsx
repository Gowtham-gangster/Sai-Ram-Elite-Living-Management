'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  DoorOpen,
  Calendar,
  Shield,
  Edit2,
  UserX,
  AlertCircle,
  Eye,
  CreditCard,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  Receipt,
  FileText,
  UserCheck,
  ShieldAlert,
  MapPin,
  Building,
  Info,
  CalendarDays,
  IndianRupee,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';
import { formatSharingType } from '@/lib/formatters';

export default function AdminResidentsPage() {
  const [residents, setResidents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filters & Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'nameAsc' | 'nameDesc' | 'roomAsc' | 'roomDesc' | 'dateDesc' | 'dateAsc' | 'rentDesc' | 'rentAsc'>('dateDesc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Profile / History Modal State
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Onboard / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    roomId: '',
    monthlyRent: 0,
    securityDeposit: '',
    checkInDate: new Date().toISOString().slice(0, 10),
    expectedCheckoutDate: '',
    checkOutDate: '',
    idProofType: 'AADHAAR',
    idProofNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    address: '',
    status: 'ACTIVE',
    notes: '',
  });

  // Change Room Modal State
  const [changeRoomModalOpen, setChangeRoomModalOpen] = useState(false);
  const [selectedResidentForTransfer, setSelectedResidentForTransfer] = useState<any>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Start Notice Period Modal State
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [selectedResidentForNotice, setSelectedResidentForNotice] = useState<any>(null);
  const [noticeCheckoutDate, setNoticeCheckoutDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [noticeNotes, setNoticeNotes] = useState('');

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedResidentForCheckout, setSelectedResidentForCheckout] = useState<any>(null);
  const [actualCheckoutDate, setActualCheckoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [refundAmount, setRefundAmount] = useState(0);
  const [deductionsAmount, setDeductionsAmount] = useState(0);
  const [checkoutNotes, setCheckoutNotes] = useState('');

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

      if (dataResidents.residents) setResidents(dataResidents.residents);
      if (dataRooms.rooms) setRooms(dataRooms.rooms);
    } catch (err) {
      console.error('Failed to load residents data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter & Sort Logic
  const processedResidents = useMemo(() => {
    return residents
      .filter((res) => {
        // Search
        if (search) {
          const q = search.toLowerCase();
          const matchName = res.fullName?.toLowerCase().includes(q);
          const matchPhone = res.phone?.includes(q);
          const matchAltPhone = res.alternatePhone?.includes(q);
          const matchEmail = res.email?.toLowerCase().includes(q);
          const matchRoom = res.room?.roomNumber?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchAltPhone && !matchEmail && !matchRoom) return false;
        }

        // Status
        if (statusFilter !== 'ALL' && res.status !== statusFilter) {
          return false;
        }

        // Room
        if (roomFilter !== 'ALL' && res.roomId !== roomFilter) {
          return false;
        }

        // Floor
        if (floorFilter !== 'ALL' && res.room?.floor !== parseInt(floorFilter, 10)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nameAsc') return a.fullName.localeCompare(b.fullName);
        if (sortBy === 'nameDesc') return b.fullName.localeCompare(a.fullName);
        if (sortBy === 'roomAsc') return a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true });
        if (sortBy === 'roomDesc') return b.room.roomNumber.localeCompare(a.room.roomNumber, undefined, { numeric: true });
        if (sortBy === 'dateDesc') return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
        if (sortBy === 'dateAsc') return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
        if (sortBy === 'rentDesc') return (b.monthlyRent || 0) - (a.monthlyRent || 0);
        if (sortBy === 'rentAsc') return (a.monthlyRent || 0) - (b.monthlyRent || 0);
        return 0;
      });
  }, [residents, search, statusFilter, roomFilter, floorFilter, sortBy]);

  // Pagination slice
  const totalPages = Math.ceil(processedResidents.length / pageSize) || 1;
  const paginatedResidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedResidents.slice(start, start + pageSize);
  }, [processedResidents, currentPage, pageSize]);

  // Handle Room Selection in Onboarding Modal
  const handleRoomSelect = (selectedRoomId: string) => {
    setFormData((prev) => ({
      ...prev,
      roomId: selectedRoomId,
    }));
  };

  const handleOpenCreateModal = () => {
    setEditingResident(null);
    const availableRoom = rooms.find((r) => r.availableSlots > 0 && r.status !== 'MAINTENANCE');
    setFormData({
      fullName: '',
      phone: '',
      alternatePhone: '',
      email: '',
      roomId: availableRoom ? availableRoom.id : '',
      monthlyRent: 8000,
      securityDeposit: '',
      checkInDate: new Date().toISOString().slice(0, 10),
      expectedCheckoutDate: '',
      checkOutDate: '',
      idProofType: 'AADHAAR',
      idProofNumber: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      address: '',
      status: 'ACTIVE',
      notes: '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (resident: any) => {
    setEditingResident(resident);
    setFormData({
      fullName: resident.fullName,
      phone: resident.phone,
      alternatePhone: resident.alternatePhone || '',
      email: resident.email || '',
      roomId: resident.roomId,
      monthlyRent: resident.monthlyRent || 0,
      securityDeposit: resident.securityDeposit ? String(resident.securityDeposit) : '',
      checkInDate: new Date(resident.checkInDate).toISOString().slice(0, 10),
      expectedCheckoutDate: resident.expectedCheckoutDate
        ? new Date(resident.expectedCheckoutDate).toISOString().slice(0, 10)
        : '',
      checkOutDate: resident.checkOutDate
        ? new Date(resident.checkOutDate).toISOString().slice(0, 10)
        : '',
      idProofType: resident.idProofType || 'AADHAAR',
      idProofNumber: resident.idProofNumber || '',
      emergencyContactName: resident.emergencyContactName || '',
      emergencyContactPhone: resident.emergencyContactPhone || '',
      address: resident.address || '',
      status: resident.status,
      notes: resident.notes || '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenProfileModal = async (residentId: string) => {
    try {
      setIsLoadingProfile(true);
      setViewProfileOpen(true);
      const res = await fetch(`/api/residents/${residentId}`);
      const data = await res.json();
      if (data.resident) {
        setProfileData(data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleOpenChangeRoom = (resident: any) => {
    setSelectedResidentForTransfer(resident);
    setTargetRoomId('');
    setTransferNotes('');
    setActionError(null);
    setChangeRoomModalOpen(true);
  };

  const handleOpenNoticeModal = (resident: any) => {
    setSelectedResidentForNotice(resident);
    setNoticeCheckoutDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    setNoticeNotes('');
    setActionError(null);
    setNoticeModalOpen(true);
  };

  const handleOpenCheckoutModal = (resident: any) => {
    setSelectedResidentForCheckout(resident);
    setActualCheckoutDate(new Date().toISOString().slice(0, 10));
    setRefundAmount(
      typeof resident.securityDeposit === 'string' && !isNaN(parseFloat(resident.securityDeposit))
        ? parseFloat(resident.securityDeposit)
        : 0
    );
    setDeductionsAmount(0);
    setCheckoutNotes('');
    setActionError(null);
    setCheckoutModalOpen(true);
  };

  // Submit Create / Edit Resident
  const handleSubmitResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSaving(true);

    try {
      const url = editingResident ? `/api/residents/${editingResident.id}` : '/api/residents';
      const method = editingResident ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save resident.');
      }

      setIsModalOpen(false);
      setActionSuccess(editingResident ? `Updated ${data.resident.fullName}.` : `Onboarded ${data.resident.fullName}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Change Room
  const handleChangeRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidentForTransfer || !targetRoomId) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/residents/${selectedResidentForTransfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_ROOM',
          newRoomId: targetRoomId,
          notes: transferNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to transfer room.');
      }

      setChangeRoomModalOpen(false);
      setActionSuccess(data.message);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'An error occurred during room transfer.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Notice Period
  const handleNoticePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidentForNotice) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/residents/${selectedResidentForNotice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_NOTICE_PERIOD',
          expectedCheckoutDate: noticeCheckoutDate,
          notes: noticeNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record notice period.');
      }

      setNoticeModalOpen(false);
      setActionSuccess(data.message);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to start notice period.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Checkout
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidentForCheckout) return;
    setActionError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/residents/${selectedResidentForCheckout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECKOUT',
          checkOutDate: actualCheckoutDate,
          refundDepositAmount: refundAmount,
          deductionsAmount: deductionsAmount,
          notes: checkoutNotes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to checkout resident.');
      }

      setCheckoutModalOpen(false);
      setActionSuccess(data.message);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to checkout resident.');
    } finally {
      setIsSaving(false);
    }
  };

  // Metrics
  const activeCount = residents.filter((r) => r.status === 'ACTIVE').length;
  const noticeCount = residents.filter((r) => r.status === 'NOTICE_PERIOD').length;
  const vacatedCount = residents.filter((r) => r.status === 'VACATED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Residents Directory</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-400" />
              <span>Room Allocation (Zero Beds)</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage hostel residents, check-in onboarding, room transfers, notice periods, and payment records.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New Resident</span>
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Residents</p>
          <p className="text-xl sm:text-2xl font-black text-white mt-1">{residents.length}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Lifetime registered</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Staying</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{activeCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Currently in rooms</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notice Period</p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{noticeCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Vacating soon</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checked Out</p>
          <p className="text-xl sm:text-2xl font-black text-slate-400 mt-1">{vacatedCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Historical records kept</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sort, Page Size */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, phone number, room #, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="NOTICE_PERIOD">Notice Period</option>
              <option value="VACATED">Checked Out (Vacated)</option>
            </select>
          </div>

          {/* Room Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={roomFilter}
              onChange={(e) => {
                setRoomFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber} (Floor {r.floor})
                </option>
              ))}
            </select>
          </div>

          {/* Floor Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={floorFilter}
              onChange={(e) => {
                setFloorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Floors</option>
              <option value="1">1st Floor</option>
              <option value="2">2nd Floor</option>
              <option value="3">3rd Floor</option>
              <option value="4">4th Floor</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="dateDesc">Sort: Check-in (Newest)</option>
              <option value="dateAsc">Sort: Check-in (Oldest)</option>
              <option value="nameAsc">Sort: Name (A to Z)</option>
              <option value="nameDesc">Sort: Name (Z to A)</option>
              <option value="roomAsc">Sort: Room # (Asc)</option>
              <option value="roomDesc">Sort: Room # (Desc)</option>
              <option value="rentDesc">Sort: Rent (High to Low)</option>
              <option value="rentAsc">Sort: Rent (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Resident Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading residents directory...</p>
          </div>
        ) : processedResidents.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-14 h-14 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No residents found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No resident records match your current search or filter criteria.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(search || statusFilter !== 'ALL' || roomFilter !== 'ALL' || floorFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setRoomFilter('ALL');
                    setFloorFilter('ALL');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 text-xs font-bold rounded-xl shadow-md"
              >
                + Onboard Resident
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Resident</th>
                    <th className="py-3.5 px-4 font-bold">Room Assigned</th>
                    <th className="py-3.5 px-4 font-bold">Monthly Tariff</th>
                    <th className="py-3.5 px-4 font-bold">Tenancy Dates</th>
                    <th className="py-3.5 px-4 font-bold">Emergency Contact</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedResidents.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Resident Info */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-white text-sm">{res.fullName}</div>
                        <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {res.phone}
                          </span>
                          {res.alternatePhone && (
                            <span className="text-[10px] text-slate-500 hidden sm:inline">
                              (Alt: {res.alternatePhone})
                            </span>
                          )}
                        </div>
                        {res.email && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{res.email}</div>
                        )}
                      </td>

                      {/* Room Assigned */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-brand-400 text-sm">
                            Room {res.room?.roomNumber}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Floor {res.room?.floor}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatSharingType(res.room?.sharingType)} (Cap: {res.room?.capacity})
                        </div>
                      </td>

                      {/* Monthly Tariff */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-slate-200">
                          ₹{(res.monthlyRent || 0).toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">/mo</span>
                        </div>
                      </td>

                      {/* Tenancy Dates */}
                      <td className="py-4 px-4">
                        <div className="text-slate-300 font-medium">
                          In: {new Date(res.checkInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {res.status === 'NOTICE_PERIOD' && res.expectedCheckoutDate && (
                          <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                            Notice: vacating {new Date(res.expectedCheckoutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                        {res.status === 'VACATED' && res.checkOutDate && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Out: {new Date(res.checkOutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>

                      {/* Emergency Contact */}
                      <td className="py-4 px-4">
                        {res.emergencyContactName ? (
                          <div>
                            <div className="text-slate-200 font-medium">{res.emergencyContactName}</div>
                            <div className="text-[10px] text-slate-400">{res.emergencyContactPhone || 'N/A'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Not provided</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <StatusBadge status={res.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Profile */}
                          <button
                            onClick={() => handleOpenProfileModal(res.id)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Full Profile & Payment History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => handleOpenEditModal(res)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Change Room (Active only) */}
                          {res.status !== 'VACATED' && (
                            <button
                              onClick={() => handleOpenChangeRoom(res)}
                              className="p-1.5 text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors"
                              title="Transfer to Another Room"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}

                          {/* Notice Period / Checkout (Active / Notice) */}
                          {res.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleOpenNoticeModal(res)}
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title="Start Notice Period"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}

                          {res.status !== 'VACATED' && (
                            <button
                              onClick={() => handleOpenCheckoutModal(res)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Check Out / Vacate"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
                  {Math.min(currentPage * pageSize, processedResidents.length)}
                </strong>{' '}
                of <strong className="text-white">{processedResidents.length}</strong> residents
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
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-semibold text-slate-300">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW RESIDENT PROFILE & PAYMENT HISTORY MODAL */}
      <Modal
        isOpen={viewProfileOpen}
        onClose={() => setViewProfileOpen(false)}
        title={profileData?.resident?.fullName || 'Resident Profile'}
        subtitle={`Room ${profileData?.resident?.room?.roomNumber} (Floor ${profileData?.resident?.room?.floor}) • Status: ${profileData?.resident?.status}`}
        maxWidth="2xl"
      >
        {isLoadingProfile || !profileData ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading profile & ledger...</p>
          </div>
        ) : (
          <div className="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1">
            {/* Contact & KYC Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-brand-400" />
                  Contact Information
                </h4>
                <div className="text-slate-300 space-y-1">
                  <div>
                    <span className="text-slate-500">Phone: </span>
                    <strong className="text-white">{profileData.resident.phone}</strong>
                  </div>
                  {profileData.resident.alternatePhone && (
                    <div>
                      <span className="text-slate-500">Alt Phone: </span>
                      <span>{profileData.resident.alternatePhone}</span>
                    </div>
                  )}
                  {profileData.resident.email && (
                    <div>
                      <span className="text-slate-500">Email: </span>
                      <span>{profileData.resident.email}</span>
                    </div>
                  )}
                  {profileData.resident.address && (
                    <div>
                      <span className="text-slate-500">Permanent Address: </span>
                      <span>{profileData.resident.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  KYC & Emergency Contact
                </h4>
                <div className="text-slate-300 space-y-1">
                  <div>
                    <span className="text-slate-500">ID Proof: </span>
                    <span>
                      {profileData.resident.idProofType || 'N/A'}{' '}
                      {profileData.resident.idProofNumber ? `(${profileData.resident.idProofNumber})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Emergency Name: </span>
                    <strong className="text-white">
                      {profileData.resident.emergencyContactName || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Emergency Phone: </span>
                    <span>{profileData.resident.emergencyContactPhone || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Room & Tenancy Financials */}
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Assigned Room</span>
                <span className="text-base font-black text-brand-400 mt-0.5 block">
                  Room {profileData.resident.room?.roomNumber}
                </span>
                <span className="text-[10px] text-slate-400">
                  Floor {profileData.resident.room?.floor} ({formatSharingType(profileData.resident.room?.sharingType)})
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Monthly Rent</span>
                <span className="text-base font-black text-white mt-0.5 block">
                  ₹{(profileData.resident.monthlyRent || 0).toLocaleString('en-IN')}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">/ month</span>
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Security Deposit</span>
                <span className="text-base font-black text-amber-400 mt-0.5 block">
                  {profileData.resident.securityDeposit !== null &&
                  profileData.resident.securityDeposit !== undefined &&
                  String(profileData.resident.securityDeposit).trim() !== ''
                    ? profileData.resident.securityDeposit
                    : 'Not provided'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Check-in Date</span>
                <span className="text-xs font-bold text-emerald-400 mt-1 block">
                  {new Date(profileData.resident.checkInDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Payment History Ledger */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  Monthly Payment Ledger ({profileData.resident.monthlyPayments?.length || 0}):
                </h4>
              </div>

              {profileData.resident.monthlyPayments?.length === 0 ? (
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-center text-slate-500 italic">
                  No payment records generated for this resident yet.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Billing Month</th>
                        <th className="py-2.5 px-3">Amount Due</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Receipt #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {profileData.resident.monthlyPayments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {p.billingMonth}
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-white">
                            ₹{p.totalAmountDue.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {p.receiptNumber ? (
                              <Link
                                href={`/admin/receipts/${p.receiptNumber}`}
                                onClick={() => setViewProfileOpen(false)}
                                className="text-brand-400 hover:underline font-semibold flex items-center gap-1"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>{p.receiptNumber}</span>
                              </Link>
                            ) : (
                              <span className="text-slate-500 italic">Unpaid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setViewProfileOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ONBOARD / EDIT RESIDENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingResident ? `Edit Resident: ${editingResident.fullName}` : 'Onboard New Resident'}
        subtitle="Allocate to an available room by capacity and capture KYC details."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitResident} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Name & Primary Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Primary Phone (WhatsApp) <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.trim() })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">10-digit Indian mobile number</p>
            </div>
          </div>

          {/* Alternate Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Alternate Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876500000"
                value={formData.alternatePhone}
                onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value.trim() })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. rahul@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Room Selection with Live Capacity Indicators */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Select Room Assignment <span className="text-rose-400">*</span>
            </label>
            <select
              required
              value={formData.roomId}
              onChange={(e) => handleRoomSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
            >
              <option value="">Choose a room...</option>
              {rooms.map((r) => {
                const count = r.occupancyCount || 0;
                const capacity = r.capacity;
                const available = Math.max(0, capacity - count);
                const isCurrent = editingResident && editingResident.roomId === r.id;
                const isFull = available <= 0 && !isCurrent;

                return (
                  <option
                    key={r.id}
                    value={r.id}
                    disabled={isFull || r.status === 'MAINTENANCE'}
                  >
                    Room {r.roomNumber} (Floor {r.floor}, {formatSharingType(r.sharingType)}) —{' '}
                    {isCurrent
                      ? 'Current Assignment'
                      : isFull
                      ? 'FULL (0 slots remaining)'
                      : `${available} of ${capacity} slots available`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Agreed Rent & Deposit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Agreed Monthly Rent (₹) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={formData.monthlyRent}
                onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Security Deposit <span className="text-[10px] text-slate-400 font-normal">(Intake / Note)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 2000, Yes, Paid, etc."
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Check-In Date & Expected Checkout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Check-In Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.checkInDate}
                onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Expected Checkout Date</label>
              <input
                type="date"
                value={formData.expectedCheckoutDate}
                onChange={(e) => setFormData({ ...formData, expectedCheckoutDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Sharma (Father)"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Emergency Contact Phone</label>
              <input
                type="tel"
                placeholder="e.g. 9876599999"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value.trim() })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* ID Proof Type & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">ID Proof Type</label>
              <select
                value={formData.idProofType}
                onChange={(e) => setFormData({ ...formData, idProofType: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              >
                <option value="AADHAAR">Aadhaar Card</option>
                <option value="PAN">PAN Card</option>
                <option value="DRIVING_LICENSE">Driving License</option>
                <option value="PASSPORT">Passport</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">ID Proof Number</label>
              <input
                type="text"
                placeholder="e.g. XXXX-XXXX-1234"
                value={formData.idProofNumber}
                onChange={(e) => setFormData({ ...formData, idProofNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Permanent Address */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">Permanent Home Address</label>
            <textarea
              rows={2}
              placeholder="e.g. #14, 2nd Main, Civil Lines, City, State - PIN"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">Internal Remarks / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Working at Tech Park, night shift on Wednesdays."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSaving ? 'Processing...' : editingResident ? 'Update Resident' : 'Complete Onboarding'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHANGE ROOM MODAL */}
      <Modal
        isOpen={changeRoomModalOpen}
        onClose={() => setChangeRoomModalOpen(false)}
        title={`Transfer Room: ${selectedResidentForTransfer?.fullName}`}
        subtitle={`Current: Room ${selectedResidentForTransfer?.room?.roomNumber} (Floor ${selectedResidentForTransfer?.room?.floor})`}
        maxWidth="md"
      >
        <form onSubmit={handleChangeRoomSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-slate-300">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Allocation:</span>
            <span className="font-bold text-white text-sm">
              Room {selectedResidentForTransfer?.room?.roomNumber}
            </span>
            <span className="text-slate-400 ml-2">
              (Floor {selectedResidentForTransfer?.room?.floor} • Rent: ₹{(selectedResidentForTransfer?.monthlyRent || 0).toLocaleString('en-IN')}/mo)
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Select Target Room <span className="text-rose-400">*</span>
            </label>
            <select
              required
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
            >
              <option value="">Select target room...</option>
              {rooms
                .filter((r) => r.id !== selectedResidentForTransfer?.roomId)
                .map((r) => {
                  const count = r.occupancyCount || 0;
                  const capacity = r.capacity;
                  const available = Math.max(0, capacity - count);
                  const isFull = available <= 0;

                  return (
                    <option key={r.id} value={r.id} disabled={isFull || r.status === 'MAINTENANCE'}>
                      Room {r.roomNumber} (Floor {r.floor}, {formatSharingType(r.sharingType)}) —{' '}
                      {isFull ? 'FULL (0 slots)' : `${available} of ${capacity} slots free`}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Transfer Reason / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Resident requested quieter room on second floor."
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setChangeRoomModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !targetRoomId}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSaving ? 'Transferring...' : 'Confirm Room Transfer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* START NOTICE PERIOD MODAL */}
      <Modal
        isOpen={noticeModalOpen}
        onClose={() => setNoticeModalOpen(false)}
        title={`Notice Period: ${selectedResidentForNotice?.fullName}`}
        subtitle={`Room ${selectedResidentForNotice?.room?.roomNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleNoticePeriodSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Expected Checkout Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={noticeCheckoutDate}
              onChange={(e) => setNoticeCheckoutDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Hostel policy requires a 30-day notice.</p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason for Notice / Notes</label>
            <textarea
              rows={3}
              placeholder="e.g. Job relocation to Hyderabad starting next month."
              value={noticeNotes}
              onChange={(e) => setNoticeNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setNoticeModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Set Notice Period'}
            </button>
          </div>
        </form>
      </Modal>

      {/* COMPLETE CHECKOUT (VACATE) MODAL */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title={`Check Out Resident: ${selectedResidentForCheckout?.fullName}`}
        subtitle={`Room ${selectedResidentForCheckout?.room?.roomNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleCheckoutSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
            Checking out will transition resident status to <strong>Checked Out</strong> and immediately free their slot in <strong>Room {selectedResidentForCheckout?.room?.roomNumber}</strong>. All historical payments and receipts are safely preserved.
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Actual Checkout Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={actualCheckoutDate}
              onChange={(e) => setActualCheckoutDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Security Deposit Refund (₹)</label>
              <input
                type="number"
                min="0"
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Damage / Deductions (₹)</label>
              <input
                type="number"
                min="0"
                value={deductionsAmount}
                onChange={(e) => setDeductionsAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Checkout Remarks & Handover Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Room keys returned, wardrobe inspected, deposit refunded via UPI."
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCheckoutModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
            >
              {isSaving ? 'Completing Checkout...' : 'Confirm Checkout & Free Room'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

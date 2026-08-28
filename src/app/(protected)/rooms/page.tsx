'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DoorOpen,
  Plus,
  Search,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Building,
  Loader2,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { formatSharingType, formatCurrency } from '@/lib/utils';

const SHARING_OPTIONS = [
  { value: 'SINGLE', label: 'Single Room (1 Person)', defaultCapacity: 1 },
  { value: 'DOUBLE', label: '2 Sharing (Double)', defaultCapacity: 2 },
  { value: 'TRIPLE', label: '3 Sharing (Triple)', defaultCapacity: 3 },
  { value: 'FOUR_SHARE', label: '4 Sharing (Quad)', defaultCapacity: 4 },
  { value: 'DORMITORY', label: '5 Sharing', defaultCapacity: 5 },
  { value: 'OTHER', label: 'Other', defaultCapacity: 1 },
];

export default function RoomsPage() {
  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter Controls
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [sharingFilter, setSharingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [inspectedRoom, setInspectedRoom] = useState<any>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [formData, setFormData] = useState({
    roomNumber: '',
    floor: 1,
    capacity: 2,
    sharingType: 'DOUBLE',
    status: 'AVAILABLE',
    notes: '',
  });

  // Delete State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<any>(null);

  // Feedback State
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/rooms');
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered & Processed Rooms
  const processedRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        // Search filter (room number or resident name)
        if (search) {
          const q = search.toLowerCase();
          const matchesRoom = room.roomNumber.toLowerCase().includes(q);
          const matchesResident = room.residents?.some((r: any) =>
            r.fullName?.toLowerCase().includes(q) || r.phone?.includes(q)
          );
          if (!matchesRoom && !matchesResident) return false;
        }

        // Floor filter
        if (floorFilter !== 'ALL' && room.floor !== parseInt(floorFilter, 10)) {
          return false;
        }

        // Sharing filter
        if (sharingFilter !== 'ALL' && room.sharingType !== sharingFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'ALL') {
          const compStatus = (room.computedStatus || room.status || '').toUpperCase();
          if (statusFilter === 'AVAILABLE' && compStatus !== 'AVAILABLE') return false;
          if (statusFilter === 'FULL' && compStatus !== 'FULL') return false;
          if (statusFilter === 'OCCUPIED' && compStatus !== 'FULL') return false;
          if (statusFilter === 'MAINTENANCE' && room.status !== 'MAINTENANCE') return false;
        }

        return true;
      })
      .sort((a, b) => {
        const numA = parseInt(a.roomNumber.replace(/\D/g, ''), 10) || a.roomNumber;
        const numB = parseInt(b.roomNumber.replace(/\D/g, ''), 10) || b.roomNumber;
        return numA < numB ? -1 : 1;
      });
  }, [rooms, search, floorFilter, sharingFilter, statusFilter]);

  // Available floors dynamically calculated
  const uniqueFloors = useMemo(() => {
    const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a: any, b: any) => a - b);
    return floors;
  }, [rooms]);

  // Handlers
  const openCreateModal = () => {
    setEditingRoom(null);
    setFormData({
      roomNumber: '',
      floor: 1,
      capacity: 2,
      sharingType: 'DOUBLE',
      status: 'AVAILABLE',
      notes: '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (room: any) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      floor: room.floor,
      capacity: room.capacity,
      sharingType: room.sharingType,
      status: room.status,
      notes: room.notes || '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const openDetailModal = (room: any) => {
    setInspectedRoom(room);
    setDetailModalOpen(true);
  };

  const confirmDelete = (room: any) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  const handleSharingChange = (sharingType: string) => {
    const opt = SHARING_OPTIONS.find((o) => o.value === sharingType);
    setFormData((prev) => ({
      ...prev,
      sharingType,
      capacity: opt ? opt.defaultCapacity : prev.capacity,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setIsSaving(true);

    try {
      if (editingRoom) {
        const res = await fetch(`/api/rooms/${editingRoom.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update room.');
        setActionSuccess(`Room ${formData.roomNumber} updated successfully.`);
      } else {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create room.');
        setActionSuccess(`Room ${formData.roomNumber} created successfully.`);
      }

      setIsModalOpen(false);
      fetchRooms();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!roomToDelete) return;
    setActionError(null);
    setActionSuccess(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/rooms/${roomToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete room.');

      setActionSuccess(`Room ${roomToDelete.roomNumber} deleted successfully.`);
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      fetchRooms();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* 1. Header & Add New Room */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <DoorOpen className="w-6 h-6 text-amber-400" />
              <span>Rooms Management</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              {rooms.length} Total Rooms
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure room inventory, floor allocation, sharing types, and capacity limits (Strictly Room Only).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchRooms}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Rooms"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Room</span>
          </button>
        </div>
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

      {/* 2. Search & Filters Bar */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search room number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Floor Filter */}
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="ALL">All Floors</option>
            {uniqueFloors.map((fl: any) => (
              <option key={fl} value={fl}>
                Floor {fl}
              </option>
            ))}
          </select>

          {/* Sharing Type Filter */}
          <select
            value={sharingFilter}
            onChange={(e) => setSharingFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="ALL">All Sharing Types</option>
            <option value="SINGLE">Single</option>
            <option value="DOUBLE">2 Sharing</option>
            <option value="TRIPLE">3 Sharing</option>
            <option value="FOUR_SHARE">4 Sharing</option>
            <option value="DORMITORY">5 Sharing</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-2xl text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="FULL">Full / Occupied</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {/* 3. Room Cards Responsive Grid */}
      {isLoading ? (
        /* Card Skeletons */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse h-64 space-y-4"
            />
          ))}
        </div>
      ) : processedRooms.length === 0 ? (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-4 max-w-lg mx-auto my-8">
          <DoorOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-200">
              {rooms.length === 0 ? 'No rooms have been added yet' : 'No rooms match your current filters'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {rooms.length === 0
                ? 'Click Add New Room to start configuring rooms, floors, and resident capacities.'
                : 'Try adjusting your search term, floor, sharing type, or status filters.'}
            </p>
          </div>
          {rooms.length === 0 ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs inline-flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Room</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFloorFilter('ALL');
                setSharingFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Room Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {processedRooms.map((room) => {
            const occupants = room.occupancyCount ?? room.residents?.length ?? 0;
            const available = Math.max(0, room.capacity - occupants);
            const isFull = available === 0 && room.status !== 'MAINTENANCE';
            const occupancyPct = room.capacity > 0 ? Math.round((occupants / room.capacity) * 100) : 0;

            return (
              <div
                key={room.id}
                onClick={() => openDetailModal(room)}
                className="p-5 rounded-3xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800/90 hover:border-amber-500/40 transition-all shadow-xl space-y-4 cursor-pointer group flex flex-col justify-between"
              >
                {/* Card Top: Room Number & Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-base group-hover:scale-105 transition-transform shadow-inner">
                        {room.roomNumber}
                      </div>
                      <div>
                        <h3 className="font-black text-white text-base tracking-tight">
                          Room {room.roomNumber}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-400">
                          Floor {room.floor}
                        </p>
                      </div>
                    </div>

                    {room.status === 'MAINTENANCE' ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                        Maintenance
                      </span>
                    ) : isFull ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
                        FULL
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                        AVAILABLE
                      </span>
                    )}
                  </div>

                  {/* Sharing Type & Monthly Tariff */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Sharing Type
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        {formatSharingType(room.sharingType)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Monthly Collection
                      </span>
                      <span className="text-xs font-black text-amber-400">
                        {formatCurrency(room.monthlyCollection || 0)}
                        <span className="text-[10px] font-normal text-slate-400">/mo</span>
                      </span>
                    </div>
                  </div>

                  {/* Occupancy Indicator & Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Occupied: {occupants}/{room.capacity}</span>
                      </span>
                      <span
                        className={`font-bold text-[11px] ${
                          isFull ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isFull ? '0 Spaces Left' : `${available} Space${available > 1 ? 's' : ''} Left`}
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFull
                            ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                            : occupants > 0
                            ? 'bg-gradient-to-r from-sky-500 to-amber-500'
                            : 'bg-slate-700'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(occupants > 0 ? 15 : 0, occupancyPct))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Actions: [View] [Edit] [Delete] */}
                <div
                  className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openDetailModal(room)}
                    className="flex-1 py-1.5 px-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(room)}
                    className="flex-1 py-1.5 px-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-sky-300 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => confirmDelete(room)}
                    className="p-1.5 bg-slate-800/80 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/30 rounded-xl transition-all cursor-pointer"
                    title="Delete Room"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Add / Edit Room Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Add New Room'}
        subtitle="Manage room configuration, capacity, sharing type, and monthly tariff."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Room Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 101, 202, A-1"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Floor <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Sharing Type <span className="text-amber-400">*</span>
              </label>
              <select
                value={formData.sharingType}
                onChange={(e) => handleSharingChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
              >
                {SHARING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Capacity (Max Residents) <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Status <span className="text-amber-400">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
            >
              <option value="AVAILABLE">Available</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any operational notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
              <span>{editingRoom ? 'Save Changes' : 'Create Room'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Room Details / Inspection Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Room ${inspectedRoom?.roomNumber || ''} Overview`}
        subtitle="Live occupancy, assigned residents, and tariff details."
      >
        {inspectedRoom && (
          <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  Capacity
                </span>
                <span className="text-sm font-extrabold text-white">
                  {inspectedRoom.capacity}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  Current Occupancy
                </span>
                <span className="text-sm font-extrabold text-amber-400">
                  {inspectedRoom.occupancyCount ?? inspectedRoom.residents?.length ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  Available Spaces
                </span>
                <span className="text-sm font-extrabold text-emerald-400">
                  {Math.max(0, inspectedRoom.capacity - (inspectedRoom.occupancyCount ?? inspectedRoom.residents?.length ?? 0))}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  Monthly Collection
                </span>
                <span className="text-sm font-extrabold text-amber-400">
                  {formatCurrency(inspectedRoom.monthlyCollection || 0)}
                </span>
              </div>
            </div>

            {/* Room Specifications */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-300">Room Details</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Floor:</span>{' '}
                  <span className="font-semibold text-slate-200">Floor {inspectedRoom.floor}</span>
                </div>
                <div>
                  <span className="text-slate-500">Sharing:</span>{' '}
                  <span className="font-semibold text-slate-200">
                    {formatSharingType(inspectedRoom.sharingType)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className="font-semibold text-slate-200">{inspectedRoom.status}</span>
                </div>
              </div>
              {inspectedRoom.notes && (
                <div className="pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-500">Notes:</span>{' '}
                  <span className="text-slate-300">{inspectedRoom.notes}</span>
                </div>
              )}
            </div>

            {/* Current Residents in Room */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>
                  Current Active Residents ({inspectedRoom.residents?.length || 0}/
                  {inspectedRoom.capacity})
                </span>
              </h4>

              {inspectedRoom.residents && inspectedRoom.residents.length > 0 ? (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80">
                  {inspectedRoom.residents.map((res: any) => (
                    <div
                      key={res.id}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{res.fullName}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{res.phone}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {res.status}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Since {new Date(res.checkInDate).toLocaleDateString('en-IN')}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                  No residents currently assigned to Room {inspectedRoom.roomNumber}.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  openEditModal(inspectedRoom);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Room</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={executeDelete}
        title="Confirm Room Deactivation / Removal"
        message={`Are you sure you want to remove Room ${roomToDelete?.roomNumber}? This action cannot be undone.`}
        confirmText="Confirm Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
}

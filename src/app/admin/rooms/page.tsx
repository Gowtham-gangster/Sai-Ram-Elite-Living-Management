'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DoorOpen,
  Plus,
  Search,
  Filter,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Eye,
  ArrowUpDown,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ShieldAlert,
  Phone,
  Calendar,
  IndianRupee,
  Check,
  Building,
  UserCheck,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';

const AVAILABLE_AMENITIES = [
  'AC',
  'Attached Washroom',
  'Balcony',
  'High Speed WiFi',
  'Wardrobe',
  'Study Desk',
  'Daily Housekeeping',
  'Geyser',
  'Smart TV',
  'Mini Fridge',
  'Lockers',
  'Window View',
];

const SHARING_OPTIONS = [
  { value: 'SINGLE', label: 'Single Room (1 Person)', defaultCapacity: 1 },
  { value: 'DOUBLE', label: '2 Sharing (Double)', defaultCapacity: 2 },
  { value: 'TRIPLE', label: '3 Sharing (Triple)', defaultCapacity: 3 },
  { value: 'FOUR_SHARE', label: '4 Sharing (Quad)', defaultCapacity: 4 },
  { value: 'DORMITORY', label: '5 Sharing', defaultCapacity: 5 },
];

import { formatSharingType } from '@/lib/formatters';

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filters & Sorting
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [sharingFilter, setSharingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'roomAsc' | 'roomDesc' | 'rentAsc' | 'rentDesc' | 'occDesc' | 'occAsc'>('roomAsc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
    amenities: [] as string[],
    status: 'AVAILABLE',
    paymentEnabled: true,
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

  // Filtered & Sorted Rooms
  const processedRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        // Search filter
        if (search) {
          const q = search.toLowerCase();
          const matchesRoom = room.roomNumber.toLowerCase().includes(q);
          const matchesResident = room.residents?.some((r: any) =>
            r.fullName.toLowerCase().includes(q) || r.phone.includes(q)
          );
          const matchesAmenities = room.amenitiesList?.some((a: string) =>
            a.toLowerCase().includes(q)
          );
          if (!matchesRoom && !matchesResident && !matchesAmenities) return false;
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
          const compStatus = room.computedStatus || room.status;
          if (statusFilter === 'AVAILABLE' && compStatus !== 'AVAILABLE') return false;
          if (statusFilter === 'FULL' && compStatus !== 'FULL') return false;
          if (statusFilter === 'MAINTENANCE' && room.status !== 'MAINTENANCE') return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'roomAsc') return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
        if (sortBy === 'roomDesc') return b.roomNumber.localeCompare(a.roomNumber, undefined, { numeric: true });
        if (sortBy === 'rentAsc') return (a.monthlyCollection || 0) - (b.monthlyCollection || 0);
        if (sortBy === 'rentDesc') return (b.monthlyCollection || 0) - (a.monthlyCollection || 0);
        if (sortBy === 'occDesc') return b.occupancyRate - a.occupancyRate;
        if (sortBy === 'occAsc') return a.occupancyRate - b.occupancyRate;
        return 0;
      });
  }, [rooms, search, floorFilter, sharingFilter, statusFilter, sortBy]);

  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    setFormData({
      roomNumber: '',
      floor: 1,
      capacity: 2,
      sharingType: 'DOUBLE',
      amenities: ['Attached Washroom', 'High Speed WiFi', 'Daily Housekeeping'],
      status: 'AVAILABLE',
      paymentEnabled: true,
      notes: '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (room: any) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      floor: room.floor,
      capacity: room.capacity,
      sharingType: room.sharingType,
      amenities: room.amenitiesList || [],
      status: room.status,
      paymentEnabled: room.paymentEnabled !== undefined ? room.paymentEnabled : true,
      notes: room.notes || '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenDetailModal = (room: any) => {
    setInspectedRoom(room);
    setDetailModalOpen(true);
  };

  const handleSharingTypeChange = (sharingType: string) => {
    const matched = SHARING_OPTIONS.find((s) => s.value === sharingType);
    setFormData((prev) => ({
      ...prev,
      sharingType,
      capacity: matched ? matched.defaultCapacity : prev.capacity,
    }));
  };

  const handleToggleAmenity = (item: string) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(item);
      if (exists) {
        return { ...prev, amenities: prev.amenities.filter((a) => a !== item) };
      } else {
        return { ...prev, amenities: [...prev.amenities, item] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsSaving(true);

    try {
      const url = editingRoom ? `/api/rooms/${editingRoom.id}` : '/api/rooms';
      const method = editingRoom ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save room details');
      }

      setIsModalOpen(false);
      setActionSuccess(editingRoom ? `Room ${data.room.roomNumber} updated.` : `Room ${data.room.roomNumber} created.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchRooms();
    } catch (err: any) {
      setActionError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!roomToDelete) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete room');
      }
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      setActionSuccess(`Room ${roomToDelete.roomNumber} deleted successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchRooms();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Occupancy summary calculations
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const totalOccupied = rooms.reduce((acc, r) => acc + (r.occupancyCount || 0), 0);
  const totalAvailable = Math.max(0, totalCapacity - totalOccupied);
  const totalFullRooms = rooms.filter((r) => r.computedStatus === 'FULL').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white">Rooms Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Strictly Capacity-Based (Zero Beds)</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure room sharing capacities, floor levels, pricing, and view assigned residents.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Room</span>
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Capacity Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</p>
          <div className="text-xl sm:text-2xl font-black text-white mt-1">
            {isLoading ? <div className="h-7 w-12 bg-slate-800 rounded-lg animate-pulse mt-1" /> : rooms.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {isLoading ? '...' : `${totalFullRooms} full / ${rooms.length - totalFullRooms} available`}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Capacity</p>
          <div className="text-xl sm:text-2xl font-black text-brand-400 mt-1">
            {isLoading ? <div className="h-7 w-16 bg-slate-800 rounded-lg animate-pulse mt-1" /> : `${totalCapacity} Residents`}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Configured slots</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Residents</p>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            {isLoading ? <div className="h-7 w-16 bg-slate-800 rounded-lg animate-pulse mt-1" /> : `${totalOccupied} Occupied`}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {isLoading ? '...' : `${totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0}% Occupancy`}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Capacity</p>
          <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1">
            {isLoading ? <div className="h-7 w-16 bg-slate-800 rounded-lg animate-pulse mt-1" /> : `${totalAvailable} Slots`}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Ready for new check-in</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sort, View Mode */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by room # (101), resident name, or amenity (AC)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Floor Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Floors</option>
              <option value="1">1st Floor</option>
              <option value="2">2nd Floor</option>
              <option value="3">3rd Floor</option>
              <option value="4">4th Floor</option>
            </select>
          </div>

          {/* Sharing Type Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={sharingFilter}
              onChange={(e) => setSharingFilter(e.target.value)}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Sharing Types</option>
              <option value="SINGLE">Single</option>
              <option value="DOUBLE">2 Sharing (Double)</option>
              <option value="TRIPLE">3 Sharing (Triple)</option>
              <option value="FOUR_SHARE">4 Sharing (Quad)</option>
              <option value="DORMITORY">5 Sharing</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available (Has Slots)</option>
              <option value="FULL">Fully Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full md:w-auto bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="roomAsc">Sort: Room # (Asc)</option>
              <option value="roomDesc">Sort: Room # (Desc)</option>
              <option value="rentAsc">Sort: Rent (Low to High)</option>
              <option value="rentDesc">Sort: Rent (High to Low)</option>
              <option value="occDesc">Sort: Occupancy (Highest)</option>
              <option value="occAsc">Sort: Occupancy (Lowest)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-brand-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-brand-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading rooms directory...</p>
        </div>
      ) : processedRooms.length === 0 ? (
        <div className="glass-panel p-16 text-center rounded-3xl border border-slate-800">
          <DoorOpen className="w-14 h-14 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No rooms matched your criteria</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Try adjusting your search query, clearing filters, or adding a new room.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {(search || floorFilter !== 'ALL' || sharingFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setFloorFilter('ALL');
                  setSharingFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Clear All Filters
              </button>
            )}
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all"
            >
              + Add Room
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedRooms.map((room) => {
            const count = room.occupancyCount || 0;
            const capacity = room.capacity;
            const availableSlots = Math.max(0, capacity - count);
            const isFull = count >= capacity;
            const percent = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
            const hasResidents = room.residents && room.residents.length > 0;

            return (
              <div
                key={room.id}
                className="glass-panel rounded-3xl p-6 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top bar */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">Room {room.roomNumber}</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          Floor {room.floor}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatSharingType(room.sharingType)}
                      </p>
                    </div>

                    <StatusBadge status={room.computedStatus || room.status} />
                  </div>

                  {/* Dynamic Occupancy & Slots Box */}
                  <div className="mb-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs font-semibold mb-2">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand-400" />
                        Room Occupancy
                      </span>
                      <span className="text-white font-bold">
                        {count} / {capacity} Residents
                      </span>
                    </div>

                    {/* Capacity Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isFull
                            ? 'bg-rose-500'
                            : percent > 50
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400">
                        Available Capacity:{' '}
                        <strong className={availableSlots > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {availableSlots} {availableSlots === 1 ? 'Slot' : 'Slots'}
                        </strong>
                      </span>
                      <span className="text-slate-500 font-mono">{percent}% filled</span>
                    </div>
                  </div>

                  {/* Residents assigned directly to this room */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Assigned Residents:
                      </span>
                      {hasResidents && (
                        <span className="text-[10px] text-slate-500">{count} Active</span>
                      )}
                    </div>

                    {!hasResidents ? (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center">
                        <p className="text-xs text-slate-500 italic">No residents assigned (Room Vacant)</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {room.residents.map((res: any) => (
                          <div
                            key={res.id}
                            className="text-xs bg-slate-800/50 hover:bg-slate-800 px-3 py-2 rounded-xl text-slate-200 flex items-center justify-between border border-slate-700/40 transition-colors"
                          >
                            <div>
                              <span className="font-semibold block">{res.fullName}</span>
                              <span className="text-[10px] text-slate-400">{res.phone}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dynamic Monthly Collection */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs mb-3">
                    <span className="text-slate-400">Monthly Collection:</span>
                    <span className="font-black text-brand-400 text-sm">
                      ₹{(room.monthlyCollection || 0).toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">/ month</span>
                    </span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDetailModal(room)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-brand-400" />
                    <span>View Room</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(room)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                      title="Edit Room Details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setRoomToDelete(room);
                        setDeleteDialogOpen(true);
                      }}
                      className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                      title="Delete Room"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Room #</th>
                  <th className="py-3.5 px-4 font-bold">Floor</th>
                  <th className="py-3.5 px-4 font-bold">Sharing Type</th>
                  <th className="py-3.5 px-4 font-bold">Capacity & Occupancy</th>
                  <th className="py-3.5 px-4 font-bold">Assigned Residents</th>
                  <th className="py-3.5 px-4 font-bold">Monthly Collection</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {processedRooms.map((room) => {
                  const count = room.occupancyCount || 0;
                  const capacity = room.capacity;
                  const availableSlots = Math.max(0, capacity - count);

                  return (
                    <tr key={room.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-mono font-black text-white text-sm">
                        Room {room.roomNumber}
                      </td>

                      <td className="py-4 px-4 text-slate-300 font-medium">
                        Floor {room.floor}
                      </td>

                      <td className="py-4 px-4 text-slate-300">
                        {formatSharingType(room.sharingType)}
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-200">
                          {count} / {capacity} Occupied
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {availableSlots} slot(s) available
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-xs">
                        {room.residents.length === 0 ? (
                          <span className="text-slate-500 italic">Vacant</span>
                        ) : (
                          <div className="space-y-0.5">
                            {room.residents.map((r: any) => (
                              <div key={r.id} className="text-slate-200 font-medium truncate">
                                {r.fullName}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 font-extrabold text-brand-400">
                        ₹{(room.monthlyCollection || 0).toLocaleString('en-IN')}/mo
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge status={room.computedStatus || room.status} />
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetailModal(room)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(room)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setRoomToDelete(room);
                              setDeleteDialogOpen(true);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW ROOM DETAILS MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Room ${inspectedRoom?.roomNumber} Overview`}
        subtitle={`Floor ${inspectedRoom?.floor} • ${formatSharingType(inspectedRoom?.sharingType)}`}
        maxWidth="lg"
      >
        {inspectedRoom && (
          <div className="space-y-5 text-xs">
            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Capacity</span>
                <span className="text-lg font-black text-white mt-0.5 block">
                  {inspectedRoom.capacity} Residents
                </span>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Occupancy</span>
                <span className="text-lg font-black text-brand-400 mt-0.5 block">
                  {inspectedRoom.occupancyCount || 0} Occupied
                </span>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Available Capacity</span>
                <span className="text-lg font-black text-emerald-400 mt-0.5 block">
                  {Math.max(0, inspectedRoom.capacity - (inspectedRoom.occupancyCount || 0))} Slots
                </span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">Payment Management:</span>
                {inspectedRoom.paymentEnabled === false ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold inline-flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Not Applicable / Excluded
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold inline-flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Enabled (₹{(inspectedRoom.monthlyCollection || 0).toLocaleString('en-IN')}/mo)
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Current Occupancy:</span>
                <span className="text-sm font-extrabold text-slate-200">
                  {inspectedRoom.occupancyCount ?? inspectedRoom.residents?.length ?? 0} / {inspectedRoom.capacity} Occupied
                </span>
              </div>
            </div>

            {/* Assigned Residents Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-400" />
                  Assigned Residents ({inspectedRoom.residents?.length || 0}):
                </h4>
                <Link
                  href="/admin/residents"
                  onClick={() => setDetailModalOpen(false)}
                  className="text-brand-400 hover:underline font-medium text-[11px]"
                >
                  Manage in Directory →
                </Link>
              </div>

              {!inspectedRoom.residents || inspectedRoom.residents.length === 0 ? (
                <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 text-center text-slate-500 italic">
                  This room is currently vacant. No residents are assigned.
                </div>
              ) : (
                <div className="space-y-2">
                  {inspectedRoom.residents.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-slate-100 text-sm block">{r.fullName}</span>
                        <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" /> {r.phone}
                          </span>
                          {r.checkInDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" /> Since{' '}
                              {new Date(r.checkInDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold self-start sm:self-auto">
                        Active Resident
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Close Overview
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  handleOpenEditModal(inspectedRoom);
                }}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Room</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE / EDIT ROOM MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Add New Room'}
        subtitle="Manage room configuration, capacity, and sharing type."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Room Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 101, 204B, 305"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value.trim() })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Floor Level <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="30"
                required
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Sharing Type</label>
              <select
                value={formData.sharingType}
                onChange={(e) => handleSharingTypeChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
              >
                {SHARING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Room Capacity (Residents) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-brand-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Max residents permitted in this room.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            >
              <option value="AVAILABLE">Available (Open for Booking)</option>
              <option value="MAINTENANCE">Under Maintenance / Renovation</option>
            </select>
          </div>

          {/* Payment Management Exclusion Setting */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                  Rent & Payment Management
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Disable this option for rooms that are not part of the hostel&apos;s rent collection system (e.g. owner, staff, or complimentary rooms).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formData.paymentEnabled}
                  onChange={(e) => setFormData({ ...formData, paymentEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <div className="text-[11px] pt-1 border-t border-slate-800">
              {formData.paymentEnabled ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Normal hostel rent & payment management enabled
                </span>
              ) : (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Excluded from rent collection, dues generation & payment reminders
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSaving ? 'Saving Room...' : editingRoom ? 'Update Room' : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={`Delete Room ${roomToDelete?.roomNumber}?`}
        message={
          roomToDelete?.occupancyCount > 0
            ? `⚠️ WARNING: Room ${roomToDelete?.roomNumber} currently has ${roomToDelete?.occupancyCount} active resident(s). You must vacate or transfer all residents before deleting this room.`
            : `Are you sure you want to permanently delete Room ${roomToDelete?.roomNumber}? This action cannot be undone.`
        }
        confirmText="Delete Room"
        isLoading={isSaving}
      />
    </div>
  );
}

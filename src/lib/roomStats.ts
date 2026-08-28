export interface RoomStats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  maintenanceRooms: number;
  inactiveRooms: number;
  totalCapacity: number;
  occupiedSpaces: number;
  availableSpaces: number;
  occupancyRate: number;
}

/**
 * Calculates unified room and occupancy metrics (Strictly Zero-Bed, Room-Based Capacity)
 */
export function getRoomStatistics(rooms: any[]): RoomStats {
  let totalRooms = rooms.length;
  let availableRooms = 0;
  let occupiedRooms = 0;
  let maintenanceRooms = 0;
  let inactiveRooms = 0;
  let totalCapacity = 0;
  let occupiedSpaces = 0;

  for (const room of rooms) {
    const capacity = room.capacity || 0;
    const currentOccupants = room.occupancyCount ?? (room.residents?.length || 0);
    totalCapacity += capacity;
    occupiedSpaces += currentOccupants;

    const status = (room.status || '').toUpperCase();
    const computedStatus = (room.computedStatus || status).toUpperCase();

    if (status === 'MAINTENANCE') {
      maintenanceRooms++;
    } else if (status === 'INACTIVE') {
      inactiveRooms++;
    } else if (computedStatus === 'FULL' || currentOccupants >= capacity) {
      occupiedRooms++;
    } else {
      availableRooms++;
    }
  }

  const availableSpaces = Math.max(0, totalCapacity - occupiedSpaces);
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedSpaces / totalCapacity) * 100) : 0;

  return {
    totalRooms,
    availableRooms,
    occupiedRooms,
    maintenanceRooms,
    inactiveRooms,
    totalCapacity,
    occupiedSpaces,
    availableSpaces,
    occupancyRate,
  };
}

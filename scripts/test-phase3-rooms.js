const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('       PHASE 3: ROOMS MANAGEMENT API & CRUD TESTS   ');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Get Auth Cookie
  console.log('--- Step 1: Admin Login ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login Status:', loginRes.status, 'Cookie Set:', Boolean(cookie));
  const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };

  // 2. Fetch Rooms Listing
  console.log('\n--- Step 2: GET /api/rooms ---');
  const roomsRes = await fetch(`${baseUrl}/api/rooms`, { headers });
  const roomsData = await roomsRes.json();
  console.log(`Fetched ${roomsData.rooms?.length} rooms.`);
  const room101 = roomsData.rooms?.find(r => r.roomNumber === '101');
  console.log('Room 101 Details:', {
    roomNumber: room101?.roomNumber,
    capacity: room101?.capacity,
    occupancyCount: room101?.occupancyCount,
    availableSlots: room101?.availableSlots,
    computedStatus: room101?.computedStatus,
    residentsCount: room101?.residents?.length,
  });
  if (!room101 || room101.capacity !== 2 || room101.occupancyCount !== 2 || room101.availableSlots !== 0) {
    throw new Error('Room 101 occupancy calculation mismatch!');
  }
  console.log('✅ Step 2 PASSED: Dynamic occupancy & available slots calculated accurately.');

  // 3. Test Room Creation (POST /api/rooms)
  console.log('\n--- Step 3: POST /api/rooms (Add Room) ---');
  const createRes = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roomNumber: '888',
      floor: 8,
      capacity: 3,
      sharingType: 'TRIPLE',
      baseRent: 8200,
      securityDeposit: 10000,
      amenities: ['AC', 'High Speed WiFi', 'Balcony'],
      status: 'AVAILABLE',
      notes: 'New top-floor triple sharing room.',
    }),
  });
  const createData = await createRes.json();
  console.log('Create Room 888 Status:', createRes.status, 'ID:', createData.room?.id);
  if (createRes.status !== 201) throw new Error('Failed to create room: ' + JSON.stringify(createData));
  const createdRoomId = createData.room.id;
  console.log('✅ Step 3 PASSED: Room created successfully.');

  // 4. Test Duplicate Room Number Rejection (POST /api/rooms)
  console.log('\n--- Step 4: Duplicate Room Number Conflict Protection ---');
  const dupRes = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roomNumber: '888', // Duplicate!
      floor: 8,
      capacity: 2,
      sharingType: 'DOUBLE',
      baseRent: 8000,
    }),
  });
  console.log('Duplicate Room Status:', dupRes.status);
  if (dupRes.status !== 409) throw new Error('Failed: Duplicate room number was not rejected with 409 Conflict!');
  console.log('✅ Step 4 PASSED: Duplicate room number properly prevented.');

  // 5. Test Room Update (PUT /api/rooms/[id])
  console.log('\n--- Step 5: PUT /api/rooms/[id] (Edit Room) ---');
  const updateRes = await fetch(`${baseUrl}/api/rooms/${createdRoomId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      roomNumber: '888',
      floor: 8,
      capacity: 4, // Increase capacity
      sharingType: 'FOUR_SHARE',
      baseRent: 8500,
      securityDeposit: 10000,
      amenities: ['AC', 'High Speed WiFi', 'Balcony', 'Mini Fridge'],
      status: 'AVAILABLE',
      notes: 'Updated capacity to 4.',
    }),
  });
  const updateData = await updateRes.json();
  console.log('Update Room Status:', updateRes.status, 'New Capacity:', updateData.room?.capacity);
  if (updateData.room?.capacity !== 4) throw new Error('Failed to update room capacity!');
  console.log('✅ Step 5 PASSED: Room details updated successfully.');

  // 6. Test Unsafe Deletion Protection (Room with active residents)
  console.log('\n--- Step 6: Unsafe Deletion Protection ---');
  const room101Id = room101.id;
  const unsafeDelRes = await fetch(`${baseUrl}/api/rooms/${room101Id}`, {
    method: 'DELETE',
    headers,
  });
  const unsafeDelData = await unsafeDelRes.json();
  console.log('Delete Room 101 (Occupied) Status:', unsafeDelRes.status, 'Error Message:', unsafeDelData.error);
  if (unsafeDelRes.status !== 400) throw new Error('Failed: Occupied room deletion was not blocked!');
  console.log('✅ Step 6 PASSED: Occupied room deletion safely blocked with descriptive warning.');

  // 7. Test Safe Deletion on Empty Room
  console.log('\n--- Step 7: DELETE /api/rooms/[id] on Empty Room ---');
  const safeDelRes = await fetch(`${baseUrl}/api/rooms/${createdRoomId}`, {
    method: 'DELETE',
    headers,
  });
  const safeDelData = await safeDelRes.json();
  console.log('Delete Empty Room 888 Status:', safeDelRes.status, 'Message:', safeDelData.message);
  if (safeDelRes.status !== 200) throw new Error('Failed to delete empty room!');
  console.log('✅ Step 7 PASSED: Empty room deleted cleanly.');

  console.log('\n🎉 ALL PHASE 3 ROOMS MANAGEMENT TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

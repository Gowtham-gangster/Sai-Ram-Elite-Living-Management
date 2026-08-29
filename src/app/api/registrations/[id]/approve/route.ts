import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const overrideRoomNumber = body.roomNumber;
    const overrideRent = body.monthlyRent;
    const overrideDeposit = body.securityDeposit;
    const adminName = body.adminName || 'Admin';

    const registration = await prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration record not found.' }, { status: 404 });
    }

    if (registration.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'This registration has already been approved.' },
        { status: 400 }
      );
    }

    if (registration.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'This registration was previously rejected. Please update status before approving.' },
        { status: 400 }
      );
    }

    // Determine Room Number
    const targetRoomNumber = (overrideRoomNumber || registration.requestedRoomNumber || '').trim();
    if (!targetRoomNumber) {
      return NextResponse.json(
        { error: 'No room specified. Please assign a room number before approving.' },
        { status: 400 }
      );
    }

    // Find Target Room
    const room = await prisma.room.findFirst({
      where: {
        roomNumber: targetRoomNumber,
      },
      include: {
        residents: {
          where: {
            status: { in: ['ACTIVE', 'NOTICE_PERIOD'] },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: `Room ${targetRoomNumber} does not exist in the hostel directory.` },
        { status: 400 }
      );
    }

    // Validate Room Capacity (CRITICAL BUSINESS INVARIANT)
    const activeOccupants = room.residents.length;
    if (activeOccupants >= room.capacity) {
      return NextResponse.json(
        {
          error: `Room ${room.roomNumber} is currently full (${activeOccupants}/${room.capacity} occupied). Please allocate a room with available capacity.`,
        },
        { status: 400 }
      );
    }

    // Check if phone already registered as active resident
    const existingResident = await prisma.resident.findUnique({
      where: { phone: registration.mobileNumber },
    });

    if (existingResident && existingResident.status !== 'VACATED') {
      return NextResponse.json(
        {
          error: `A resident with mobile number ${registration.mobileNumber} is already active in Room ${existingResident.roomId}.`,
        },
        { status: 400 }
      );
    }

    const rentAmount = overrideRent !== undefined ? Number(overrideRent) : (registration.monthlyRent || 0.0);
    const depositValue =
      overrideDeposit !== undefined && overrideDeposit !== null && String(overrideDeposit).trim() !== ''
        ? String(overrideDeposit).trim()
        : (registration.securityDeposit || null);
    const checkIn = registration.checkInDate || new Date();

    // Execute atomic onboarding transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create Resident
      const resident = await tx.resident.create({
        data: {
          fullName: registration.fullName,
          phone: registration.mobileNumber,
          roomId: room.id,
          monthlyRent: rentAmount,
          securityDeposit: depositValue,
          checkInDate: checkIn,
          idProofType: 'AADHAAR',
          idProofNumber: registration.aadhaarNumber || null,
          identityDocumentUrl: registration.identityDocumentUrl || null,
          googleDriveFileId: registration.googleDriveFileId || null,
          emergencyContactName: registration.guardianName || null,
          emergencyContactPhone: registration.emergencyContactNumber || null,
          address: registration.companyOrCollegeName || null,
          status: 'ACTIVE',
        },
      });

      // 2. Create Initial Payment Due for Current Month
      const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g. "2026-08"
      const dueDate = new Date();
      dueDate.setDate(5); // 5th of current month

      await tx.monthlyPayment.create({
        data: {
          residentId: resident.id,
          roomId: room.id,
          billingMonth: currentMonthStr,
          rentAmount,
          maintenanceAmount: 0.0,
          penaltyAmount: 0.0,
          discountAmount: 0.0,
          totalAmountDue: rentAmount,
          status: 'PENDING',
          dueDate,
          notes: 'Initial monthly rent generated upon registration approval',
        },
      });

      // 3. Update Room Status if now full
      if (activeOccupants + 1 >= room.capacity) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: 'FULL' },
        });
      }

      // 4. Update Registration
      const updatedRegistration = await tx.registration.update({
        where: { id: registration.id },
        data: {
          status: 'APPROVED',
          reviewedBy: adminName,
          reviewedAt: new Date(),
          residentId: resident.id,
          requestedRoomNumber: room.roomNumber,
        },
      });

      // 5. Create Admin In-App Notification
      await tx.notification.create({
        data: {
          type: 'SUCCESS',
          title: 'Resident Onboarded',
          message: `${resident.fullName} approved and allocated to Room ${room.roomNumber}.`,
          linkUrl: `/residents/${resident.id}`,
        },
      });

      return { resident, updatedRegistration };
    });

    return NextResponse.json({
      success: true,
      message: `${result.resident.fullName} has been approved and assigned to Room ${room.roomNumber}.`,
      resident: result.resident,
      registration: result.updatedRegistration,
    });
  } catch (error: any) {
    console.error('Registration approval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve registration.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const room = searchParams.get('room');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    if (room && room !== 'ALL') {
      where.requestedRoomNumber = room;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search } },
        { companyOrCollegeName: { contains: search, mode: 'insensitive' } },
        { requestedRoomNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, registrations, stats] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { sourceSubmittedAt: 'desc' },
        select: {
          id: true,
          externalSource: true,
          externalResponseId: true,
          fullName: true,
          mobileNumber: true,
          guardianName: true,
          emergencyContactNumber: true,
          aadhaarNumber: true,
          occupation: true,
          occupationType: true,
          companyOrCollegeName: true,
          requestedRoomNumber: true,
          checkInDate: true,
          monthlyRent: true,
          securityDeposit: true,
          declarationAccepted: true,
          declarationAcceptedAt: true,
          sourceSubmittedAt: true,
          identityDocumentUrl: true,
          googleDriveFileId: true,
          status: true,
          reviewedBy: true,
          reviewedAt: true,
          rejectionReason: true,
          residentId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      Promise.all([
        prisma.registration.count(),
        prisma.registration.count({ where: { status: 'NEW' } }),
        prisma.registration.count({ where: { status: 'UNDER_REVIEW' } }),
        prisma.registration.count({ where: { status: 'APPROVED' } }),
        prisma.registration.count({ where: { status: 'REJECTED' } }),
      ]),
    ]);

    return NextResponse.json({
      registrations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: stats[0],
        new: stats[1],
        underReview: stats[2],
        approved: stats[3],
        rejected: stats[4],
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch registrations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch registrations.' },
      { status: 500 }
    );
  }
}

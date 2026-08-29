import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/google/auth';
import { generateReceiptPdf } from '@/lib/receipts/receiptPdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Valid receipt token is required.' }, { status: 400 });
    }

    const cleanToken = token.trim();

    // Query Receipt by downloadToken or receiptNumber
    const receipt = await prisma.receipt.findFirst({
      where: {
        OR: [
          { downloadToken: cleanToken },
          { receiptNumber: cleanToken },
          { id: cleanToken },
        ],
      },
      include: {
        monthlyPayment: {
          include: {
            resident: true,
            room: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found or invalid token.' }, { status: 404 });
    }

    const cleanName = (receipt.residentName || 'Resident').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanMonth = (receipt.billingMonth || 'Rent').replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName = `${receipt.receiptNumber}_${cleanName}_${cleanMonth}.pdf`;

    // 1. If Google Drive file ID is available, stream from Google Drive
    if (receipt.googleDriveFileId) {
      try {
        const auth = getGoogleAuthClient();
        const drive = google.drive({ version: 'v3', auth });

        const driveRes = await drive.files.get(
          {
            fileId: receipt.googleDriveFileId,
            alt: 'media',
            supportsAllDrives: true,
          },
          { responseType: 'arraybuffer' }
        );

        const pdfBuffer = Buffer.from(driveRes.data as ArrayBuffer);

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': String(pdfBuffer.length),
            'Cache-Control': 'private, no-transform, max-age=3600',
          },
        });
      } catch (driveErr) {
        console.warn('Could not stream directly from Google Drive, generating fresh vector PDF:', driveErr);
      }
    }

    // 2. High-Availability Fallback: generate fresh vector PDF directly from verified receipt data
    const hostelSettings = await prisma.hostelSettings.findUnique({
      where: { id: 'default' },
    });

    const freshPdfBytes = await generateReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      residentName: receipt.residentName,
      roomNumber: receipt.roomNumber,
      billingMonth: receipt.billingMonth,
      amountPaid: receipt.amountPaid,
      paymentDate: receipt.paymentDate,
      paymentMethod: receipt.paymentMethod,
      transactionReference: receipt.monthlyPayment?.transactionReference || receipt.notes,
      hostelName: hostelSettings?.hostelName || 'SAIRAM ELITE LIVING',
      hostelAddress:
        hostelSettings?.hostelAddress ||
        'Plot No. 57, Near Pragati Model High School, Beside Vibhu Park Apartment, Gandi Maisamma, Hyderabad, Telangana – 500043',
      contactPhone: hostelSettings?.contactPhone || '+91 8977339133, 918688535143',
    });

    const pdfBuffer = Buffer.from(freshPdfBytes);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-transform, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error serving receipt download:', error);
    return NextResponse.json(
      { error: 'Failed to download receipt PDF.' },
      { status: 500 }
    );
  }
}

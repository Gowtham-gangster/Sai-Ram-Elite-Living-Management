import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { formatDate } from '@/lib/dateUtils';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const status = searchParams.get('status');

    const where: any = {};
    if (month && month !== 'ALL') where.billingMonth = month;
    if (status && status !== 'ALL') where.status = status;

    const payments = await db.monthlyPayment.findMany({
      where,
      orderBy: [{ billingMonth: 'desc' }, { room: { roomNumber: 'asc' } }],
      include: {
        resident: {
          select: {
            fullName: true,
            phone: true,
          },
        },
        room: {
          select: {
            roomNumber: true,
            floor: true,
          },
        },
        receipts: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const rows = payments.map((p) => ({
      'Billing Month': p.billingMonth,
      'Resident Name': p.resident.fullName,
      'Mobile Number': p.resident.phone,
      'Room Number': `Room ${p.room.roomNumber}`,
      'Monthly Rent (INR)': p.rentAmount,
      'Total Amount Due (INR)': p.totalAmountDue,
      'Payment Status': p.status,
      'Due Date': formatDate(p.dueDate, 'N/A'),
      'Paid Date': formatDate(p.paidDate, 'N/A'),
      'Payment Method': p.paymentMethod || (p.status === 'PAID' ? 'UPI' : 'N/A'),
      'Transaction Reference': p.transactionReference || 'N/A',
      'Gateway Provider': p.gatewayProvider || 'N/A',
      'Receipt Number': p.receipts?.[0]?.receiptNumber || p.receiptNumber || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Ledger');

    // Auto-fit column widths
    const maxCols = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, 14),
    }));
    worksheet['!cols'] = maxCols;

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `Payments_Ledger_${month || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting payments:', error);
    return NextResponse.json({ error: 'Failed to export payment ledger.' }, { status: 500 });
  }
}

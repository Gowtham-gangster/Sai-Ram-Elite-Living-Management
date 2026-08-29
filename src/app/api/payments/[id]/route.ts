import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { UpdatePaymentStatusSchema } from '@/lib/validations';
import { updatePaymentStatus } from '@/lib/payment-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const payment = await db.monthlyPayment.findUnique({
      where: { id },
      include: {
        resident: true,
        room: true,
        paymentRecords: {
          orderBy: { paymentDate: 'desc' },
        },
        receipts: true,
        reminders: {
          orderBy: { scheduledFor: 'desc' },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Failed to fetch payment record' }, { status: 500 });
  }
}

// Edit Payment Bill Breakdown & Line items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const rentAmount = parseFloat(body.rentAmount) || 0;
    const maintenanceAmount = parseFloat(body.maintenanceAmount) || 0;
    const penaltyAmount = parseFloat(body.penaltyAmount) || 0;
    const discountAmount = parseFloat(body.discountAmount) || 0;
    const totalAmountDue = Math.max(0, rentAmount + maintenanceAmount + penaltyAmount - discountAmount);

    const updated = await db.monthlyPayment.update({
      where: { id },
      data: {
        rentAmount,
        maintenanceAmount,
        penaltyAmount,
        discountAmount,
        totalAmountDue,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
      include: {
        resident: true,
        room: true,
      },
    });

    return NextResponse.json({ success: true, payment: updated });
  } catch (error: any) {
    console.error('Error updating payment bill:', error);
    return NextResponse.json({ error: 'Failed to update payment bill' }, { status: 500 });
  }
}

// Update Payment Status (Paid, Overdue, Rejected, Submitted, Pending)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdatePaymentStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid status data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { status, notes } = parsed.data;

    const result = await updatePaymentStatus(
      id,
      status,
      notes || undefined,
      { id: session.userId, name: session.name }
    );

    return NextResponse.json({
      ...result,
      payment: {
        id,
        status: result.newStatus,
      },
    });
  } catch (error: any) {
    console.error('Error updating payment status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update status' }, { status: 500 });
  }
}

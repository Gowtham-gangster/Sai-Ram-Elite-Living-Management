import { NextRequest, NextResponse } from 'next/server';
import { PaymentSessionService } from '@/lib/payments/paymentSessionService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || searchParams.get('referenceId') || searchParams.get('id');

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Valid sessionId or referenceId query parameter is required.' },
        { status: 400 }
      );
    }

    const statusResult = await PaymentSessionService.getSessionStatus(sessionId);

    if (!statusResult.found) {
      return NextResponse.json(
        { found: false, status: 'NOT_FOUND', error: 'Payment session not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(statusResult);
  } catch (error: any) {
    console.error('Error in GET /api/payments/session/status:', error);
    return NextResponse.json(
      { error: 'Internal server error checking payment status.' },
      { status: 500 }
    );
  }
}

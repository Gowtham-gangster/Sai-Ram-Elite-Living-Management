import { NextRequest, NextResponse } from 'next/server';
import { defaultPaymentProvider } from '@/lib/payments/provider';
import { processVerifiedPayment } from '@/lib/payments/verification';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty webhook payload' }, { status: 400 });
    }

    const signatureHeader =
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-signature') ||
      request.headers.get('x-gateway-signature') ||
      request.headers.get('x-razorpay-signature');

    // 1. Cryptographic Signature Validation
    const isSignatureValid = defaultPaymentProvider.verifyWebhookSignature(
      rawBody,
      signatureHeader
    );

    if (!isSignatureValid) {
      console.warn('[Webhook Warning] Unauthorized webhook attempt: invalid signature.');
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing webhook signature.' },
        { status: 401 }
      );
    }

    // 2. Parse Payload
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const payload = defaultPaymentProvider.parseWebhookPayload(parsedBody);
    if (!payload) {
      return NextResponse.json(
        { error: 'Malformed payment payload: referenceId or amount missing.' },
        { status: 400 }
      );
    }

    // 3. Process Verified Payment Transactionally
    const result = await processVerifiedPayment(payload);

    if (!result.success) {
      return NextResponse.json(
        {
          received: true,
          processed: false,
          status: result.status,
          error: result.error,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      received: true,
      processed: true,
      status: result.status,
      referenceId: result.referenceId,
      monthlyPaymentId: result.monthlyPaymentId,
      isDuplicate: result.isDuplicate || false,
    });
  } catch (error: any) {
    console.error('Error handling payment webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error processing webhook.' },
      { status: 500 }
    );
  }
}

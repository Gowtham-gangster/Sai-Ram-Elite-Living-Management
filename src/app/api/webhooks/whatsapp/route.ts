import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getWhatsAppConfig, MetaWebhookStatus } from '@/lib/whatsapp';

/**
 * GET /api/webhooks/whatsapp
 * Meta WhatsApp Webhook Challenge Verification
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const config = getWhatsAppConfig();

  // If verify token is not set yet in dev, accept if match or configured
  const expectedToken = config.verifyToken || 'sairam_whatsapp_verify_token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsApp Webhook] Verification successful. Challenge accepted.');
    return new Response(challenge || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[WhatsApp Webhook] Verification failed. Token mismatch.');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Meta WhatsApp Webhook Status & Message Processing
 * 
 * IMPORTANT:
 * - Acknowledges fast (HTTP 200) within SLA.
 * - Updates delivery statuses (sent, delivered, read, failed).
 * - Strictly NEVER marks MonthlyPayment as PAID.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true, note: 'Not a whatsapp_business_account object' }, { status: 200 });
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const statuses: MetaWebhookStatus[] = value?.statuses || [];

        for (const status of statuses) {
          const messageId = status.id;
          const statusType = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();

          if (!messageId) continue;

          // Find reminder with this providerMessageId
          const reminder = await db.paymentReminder.findFirst({
            where: { providerMessageId: messageId },
          });

          if (reminder) {
            let mappedStatus: string = reminder.status;
            let failureReason = reminder.failureReason;

            if (statusType === 'failed') {
              mappedStatus = 'FAILED';
              const errorObj = status.errors?.[0];
              failureReason = errorObj ? `${errorObj.title || 'Error'}: ${errorObj.message || ''}` : 'Message delivery failed';
            } else if (statusType === 'sent' || statusType === 'delivered' || statusType === 'read') {
              if (reminder.status !== 'CANCELLED') {
                mappedStatus = 'SENT';
              }
            }

            await db.paymentReminder.update({
              where: { id: reminder.id },
              data: {
                status: mappedStatus,
                failureReason,
                sentAt: reminder.sentAt || timestamp,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WhatsApp Webhook Handler Error]', error);
    // Always return 200 to Meta so it doesn't drop the webhook subscription
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}

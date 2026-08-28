import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { GenerateDuesSchema } from '@/lib/validations';
import { generateMonthlyBillsForActiveResidents } from '@/lib/payment-engine';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = GenerateDuesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid billing month format. Expected YYYY-MM.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { billingMonth } = parsed.data;

    const result = await generateMonthlyBillsForActiveResidents(billingMonth, {
      id: session.userId,
      name: session.name,
    });

    return NextResponse.json({
      success: true,
      message: `Generated dues for ${result.generatedCount} active resident(s) for ${billingMonth}. (${result.skippedCount} already existed).`,
      result,
    });
  } catch (error: any) {
    console.error('Error generating dues:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate monthly dues' }, { status: 500 });
  }
}

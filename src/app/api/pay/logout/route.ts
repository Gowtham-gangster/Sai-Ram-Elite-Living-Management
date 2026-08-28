import { NextRequest, NextResponse } from 'next/server';
import { RESIDENT_COOKIE_NAME } from '@/lib/residentAuth';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Resident logged out successfully',
    });

    response.cookies.delete(RESIDENT_COOKIE_NAME);

    return response;
  } catch (error: any) {
    console.error('Error in /api/pay/logout:', error);
    return NextResponse.json({ success: false, error: 'Failed to logout' }, { status: 500 });
  }
}

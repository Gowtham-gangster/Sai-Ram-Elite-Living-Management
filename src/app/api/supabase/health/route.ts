import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Supabase environment variables are missing.',
          configured: false,
        },
        { status: 500 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Safe connection verification using auth service ping
    const { error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to communicate with Supabase service.',
          configured: true,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        connected: true,
        service: 'Supabase',
        configured: true,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Internal server error during Supabase health check.',
        configured: true,
      },
      { status: 500 }
    );
  }
}

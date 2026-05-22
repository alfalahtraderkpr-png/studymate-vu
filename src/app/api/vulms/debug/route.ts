import { NextRequest, NextResponse } from 'next/server';
import { debugDumpPage } from '@/lib/vulms';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { cookies, url } = await request.json();

    if (!cookies || !url) {
      return NextResponse.json(
        { error: 'Cookies and URL are required' },
        { status: 400 }
      );
    }

    const data = await debugDumpPage(cookies, url);

    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Debug dump failed';
    console.error('[VULMS Debug] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

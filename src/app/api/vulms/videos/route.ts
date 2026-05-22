import { NextRequest, NextResponse } from 'next/server';
import { getVideoLectures } from '@/lib/vulms';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { cookies, courseEventTarget } = await request.json();

    if (!cookies || !courseEventTarget) {
      return NextResponse.json(
        { error: 'Cookies and courseEventTarget are required' },
        { status: 400 }
      );
    }

    const videos = await getVideoLectures(cookies, courseEventTarget);

    return NextResponse.json({ videos });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch videos';
    console.error('[VULMS Videos] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAssignments } from '@/lib/vulms';

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

    const assignments = await getAssignments(cookies, courseEventTarget);

    return NextResponse.json({ assignments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch assignments';
    console.error('[VULMS Assignments] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

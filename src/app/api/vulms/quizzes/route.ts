import { NextRequest, NextResponse } from 'next/server';
import { getQuizzes } from '@/lib/vulms';

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

    const quizzes = await getQuizzes(cookies, courseEventTarget);

    return NextResponse.json({ quizzes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch quizzes';
    console.error('[VULMS Quizzes] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

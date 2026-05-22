import { NextRequest, NextResponse } from 'next/server';
import { getAllCourseData } from '@/lib/vulms';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const { cookies, courseEventTarget, subjectCode } = await request.json();

    if (!cookies || !courseEventTarget) {
      return NextResponse.json(
        { error: 'Cookies and courseEventTarget are required' },
        { status: 400 }
      );
    }

    const courseData = await getAllCourseData(cookies, courseEventTarget, subjectCode);

    return NextResponse.json({ courseData });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch course data';
    console.error('[VULMS CourseData] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

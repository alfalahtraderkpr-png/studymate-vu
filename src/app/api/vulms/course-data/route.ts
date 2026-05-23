import { NextRequest, NextResponse } from 'next/server';
import { getAllCourseData } from '@/lib/vulms';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const { cookies, courseEventTarget, subjectCode, skipDetails } = await request.json();

    if (!cookies || !courseEventTarget) {
      return NextResponse.json(
        { error: 'Cookies and courseEventTarget are required' },
        { status: 400 }
      );
    }

    // skipDetails=true by default for fast initial load (just CourseHome data)
    // skipDetails=false when user clicks into a subject for full details
    const courseData = await getAllCourseData(
      cookies,
      courseEventTarget,
      subjectCode,
      skipDetails !== false // default to true (skip details for speed)
    );

    return NextResponse.json({ courseData });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch course data';
    console.error('[VULMS CourseData] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

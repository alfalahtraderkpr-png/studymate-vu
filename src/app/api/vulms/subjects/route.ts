import { NextRequest, NextResponse } from 'next/server';
import { getSubjects, getHandouts } from '@/lib/vulms';

export async function POST(request: NextRequest) {
  try {
    const { cookies, sessionUrl } = await request.json();

    if (!cookies || !Array.isArray(cookies)) {
      return NextResponse.json(
        { error: 'Valid cookies are required' },
        { status: 400 }
      );
    }

    // If a specific course URL is provided, get handouts for that course
    if (sessionUrl) {
      const handouts = await getHandouts(cookies, sessionUrl);
      return NextResponse.json({ handouts });
    }

    // Otherwise, get the list of subjects
    const subjects = await getSubjects(cookies);

    // Get handouts for each subject
    const subjectsWithHandouts: Array<{ name: string; code: string; url: string; handouts: any[] }> = [];
    for (const subject of subjects) {
      try {
        const handouts = await getHandouts(cookies, subject.url);
        subjectsWithHandouts.push({
          ...subject,
          handouts,
        });
      } catch {
        // Skip subjects that fail to load
        subjectsWithHandouts.push({
          ...subject,
          handouts: [],
        });
      }
    }

    return NextResponse.json({ subjects: subjectsWithHandouts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch subjects';
    console.error('[VULMS Subjects] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

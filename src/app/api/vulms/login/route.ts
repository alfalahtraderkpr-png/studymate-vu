import { NextRequest, NextResponse } from 'next/server';
import { loginToVULMS, getSubjects } from '@/lib/vulms';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { studentId, password } = await request.json();

    if (!studentId || !password) {
      return NextResponse.json(
        { error: 'Student ID and password are required' },
        { status: 400 }
      );
    }

    // Try to login to VULMS
    const { cookies, browser } = await loginToVULMS(studentId, password);

    // Get subjects list
    const subjects = await getSubjects(cookies, browser);

    // Save session to database
    const session = await db.studySession.create({
      data: {
        studentId,
        cookies: JSON.stringify(cookies),
      },
    });

    // Save subjects to database
    for (const subject of subjects) {
      await db.subject.create({
        data: {
          sessionId: session.id,
          name: subject.name,
          code: subject.code,
          handouts: JSON.stringify([]),
        },
      });
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      cookies,
      subjects,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

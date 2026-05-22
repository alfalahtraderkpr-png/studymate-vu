import { NextRequest, NextResponse } from 'next/server';
import { loginToVULMS } from '@/lib/vulms';

export const maxDuration = 60; // Allow up to 60 seconds for login

export async function POST(request: NextRequest) {
  try {
    const { studentId, password } = await request.json();

    if (!studentId || !password) {
      return NextResponse.json(
        { error: 'Student ID and password are required' },
        { status: 400 }
      );
    }

    console.log(`[VULMS Login] Attempting login for: ${studentId}`);

    // Login to VULMS using direct HTTP requests (no Puppeteer!)
    const { cookies, subjects } = await loginToVULMS(studentId, password);

    console.log(`[VULMS Login] Success! Found ${subjects.length} subjects`);

    // Format cookies for client-side storage
    const formattedCookies = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));

    return NextResponse.json({
      success: true,
      cookies: formattedCookies,
      subjects,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Login failed. Please try again.';
    console.error('[VULMS Login] Error:', message);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

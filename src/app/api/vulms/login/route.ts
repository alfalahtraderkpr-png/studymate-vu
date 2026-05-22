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

    // Login to VULMS using Puppeteer
    const { cookies, subjects, browser } = await loginToVULMS(studentId, password);

    // Close browser after we're done
    try { await browser.close(); } catch {}

    // Format cookies for client-side storage
    const formattedCookies = cookies.map((c: Record<string, unknown>) => ({
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
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { downloadHandoutContent } from '@/lib/vulms';

export async function POST(request: NextRequest) {
  try {
    const { cookies, handoutUrl } = await request.json();

    if (!cookies || !handoutUrl) {
      return NextResponse.json(
        { error: 'Cookies and handout URL are required' },
        { status: 400 }
      );
    }

    const content = await downloadHandoutContent(cookies, handoutUrl);

    // Extract a title from the URL or content
    const urlParts = handoutUrl.split('/');
    const title =
      decodeURIComponent(urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'Handout');

    return NextResponse.json({ content, title });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch handout';
    console.error('[VULMS Handout] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

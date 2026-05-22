import { NextRequest, NextResponse } from 'next/server';
import { chatAboutContent } from '@/lib/ai-engine';

export async function POST(request: NextRequest) {
  try {
    const { messages, subjectContext } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const response = await chatAboutContent(messages, subjectContext || '');

    return NextResponse.json({ response });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

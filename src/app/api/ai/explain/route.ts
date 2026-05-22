import { NextRequest, NextResponse } from 'next/server';
import { explainContent } from '@/lib/ai-engine';

export async function POST(request: NextRequest) {
  try {
    const { content, subjectName, topicName } = await request.json();

    if (!content || !subjectName) {
      return NextResponse.json(
        { error: 'Content and subject name are required' },
        { status: 400 }
      );
    }

    const explanation = await explainContent(
      content,
      subjectName,
      topicName || 'General Topic'
    );

    return NextResponse.json({ explanation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate explanation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

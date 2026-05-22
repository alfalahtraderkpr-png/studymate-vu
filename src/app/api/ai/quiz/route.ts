import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz } from '@/lib/ai-engine';

export async function POST(request: NextRequest) {
  try {
    const { content, subjectName, numQuestions } = await request.json();

    if (!content || !subjectName) {
      return NextResponse.json(
        { error: 'Content and subject name are required' },
        { status: 400 }
      );
    }

    const questions = await generateQuiz(
      content,
      subjectName,
      numQuestions || 5
    );

    return NextResponse.json({ questions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate quiz';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

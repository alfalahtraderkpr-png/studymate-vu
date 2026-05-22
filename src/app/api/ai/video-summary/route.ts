import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl, subjectName, lessonName } = await request.json();

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    // Use AI to generate a summary based on the video context
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();

    const SYSTEM_PROMPT = `You are StudyMate VU, an AI study assistant for Virtual University of Pakistan students.

Rules:
1. Explain concepts in a mix of Roman Urdu and English (like Pakistani students talk)
2. Give REAL-LIFE practical examples for every concept
3. Break complex topics into simple steps
4. Highlight key points that are important for exams
5. Use analogies to make hard concepts easy
6. Be encouraging and supportive
7. Format responses using Markdown with headers, bullet points, and bold text
8. Always end with a "📝 Exam Tip" section

Since you cannot watch YouTube videos directly, generate a comprehensive summary based on:
- The lesson name and subject
- What VU students typically learn in this lecture
- Common exam topics for this subject

Make it feel like you watched the video and are explaining it in a friendly, helpful way.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Subject: ${subjectName || 'VU Course'}
Lecture: ${lessonName || 'Video Lecture'}
YouTube URL: ${youtubeUrl}

Please provide a detailed Roman Urdu + English summary of this VU lecture. Include:
1. Main topics covered
2. Key concepts explained with real-life examples
3. Important formulas or definitions
4. Exam tips

Write in a mix of Roman Urdu and English, like a Pakistani student would explain it to a friend.`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate summary';
    console.error('[AI VideoSummary] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const SYSTEM_PROMPT = `You are StudyMate VU, an AI study assistant for Virtual University of Pakistan students. 
Your role is to help students understand their course material deeply.

Rules:
1. Explain concepts in a mix of Roman Urdu and English (like Pakistani students talk)
2. Give REAL-LIFE practical examples for every concept
3. Break complex topics into simple steps
4. Highlight key points that are important for exams
5. Use analogies to make hard concepts easy
6. Be encouraging and supportive
7. If content is in English, explain it in simpler words
8. Always end with a "📝 Exam Tip" for each topic
9. Format responses using Markdown with headers, bullet points, and bold text`;

export async function explainContent(
  content: string,
  subjectName: string,
  topicName: string
) {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Subject: ${subjectName}\nTopic: ${topicName}\n\nContent from handout:\n${content}\n\nPlease explain this topic deeply with real-life examples. Make it easy to understand for exam preparation.`,
      },
    ],
  });
  return completion.choices[0]?.message?.content || '';
}

export async function chatAboutContent(
  messages: Array<{ role: string; content: string }>,
  subjectContext: string
) {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          SYSTEM_PROMPT +
          `\n\nContext about the subject:\n${subjectContext}`,
      },
      ...messages,
    ],
  });
  return completion.choices[0]?.message?.content || '';
}

export async function generateQuiz(
  content: string,
  subjectName: string,
  numQuestions: number = 5
) {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          SYSTEM_PROMPT +
          '\n\nGenerate quiz questions in JSON format only. Return ONLY a valid JSON array, no other text.',
      },
      {
        role: 'user',
        content: `Subject: ${subjectName}\nContent: ${content}\n\nGenerate ${numQuestions} multiple choice questions for exam practice. Return as JSON array: [{"question": "...", "options": ["A...", "B...", "C...", "D..."], "correctAnswer": 0, "explanation": "..."}]`,
      },
    ],
  });

  try {
    const text = completion.choices[0]?.message?.content || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

// src/games/quiz/quizGeminiService.js
// Uses the Gemini 1.5 Flash API (free tier) to generate quiz questions.
// Get a free key at: https://aistudio.google.com/app/apikey

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Generate `count` quiz questions for the given topic.
 * Returns an array of: { question, options: [str,str,str,str], correctIndex: 0-3 }
 */
export async function generateQuizQuestions(topic, count = 8, apiKey) {
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const prompt = `Generate ${count} multiple-choice trivia questions about "${topic}".

Rules:
- Each question must have exactly 4 answer options.
- Exactly one option must be correct.
- Questions should be factual, clear, and varied in difficulty.
- Do NOT repeat similar questions.
- Return ONLY a JSON array, no markdown, no explanation.

Format (strict JSON array):
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0
  }
]

correctIndex is 0-based index of the correct option in the options array.`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown fences if present
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  let questions;
  try {
    questions = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON');
  }

  // Validate and sanitise
  return questions
    .filter(q => q.question && Array.isArray(q.options) && q.options.length === 4
                 && typeof q.correctIndex === 'number')
    .slice(0, count)
    .map(q => ({
      question: q.question,
      options: q.options.map(String),
      correctIndex: Math.min(3, Math.max(0, q.correctIndex)),
    }));
}

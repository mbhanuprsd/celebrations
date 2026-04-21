// src/games/quiz/quizGeminiService.js
// Tries the Gemini API first; falls back to the built-in question bank on any error.
// Free key: https://aistudio.google.com/app/apikey (no billing required)

import { getFallbackQuestions } from './quizFallbackBank';

const GEMINI_MODEL = 'gemini-2.5-flash';
// AI Studio keys use v1beta — do NOT change to v1 (that's for Vertex AI keys)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function generateQuizQuestions(topic, count = 8, apiKey) {
  if (!apiKey) {
    console.info('ℹ️ No REACT_APP_GEMINI_API_KEY — using built-in question bank.');
    return getFallbackQuestions(topic, count);
  }

  console.info(`🧠 Calling Gemini for topic: "${topic}" (${count} questions)…`);
  try {
    const questions = await fetchFromGemini(topic, count, apiKey);
    console.info(`✅ Gemini returned ${questions.length} questions.`);
    if (questions.length >= count) return questions;
    // Top up from fallback if Gemini returned fewer than requested
    const extra = getFallbackQuestions(topic, count - questions.length);
    return [...questions, ...extra].slice(0, count);
  } catch (err) {
    if (err.message?.includes('429') || err.message?.includes('spending cap')) {
      console.warn('⚠️ Gemini quota hit (429). Using built-in bank.\nFix: get a key from aistudio.google.com/app/apikey — no billing needed.');
    } else if (err.message?.includes('400') || err.message?.includes('API_KEY_INVALID')) {
      console.warn('⚠️ Gemini API key is invalid. Check REACT_APP_GEMINI_API_KEY in your .env file.');
    } else {
      console.warn('⚠️ Gemini error — using built-in bank:', err.message);
    }
    return getFallbackQuestions(topic, count);
  }
}

async function fetchFromGemini(topic, count, apiKey) {
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

correctIndex is the 0-based index of the correct option.`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  console.debug('Gemini raw response:', raw);
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error('Failed to parse Gemini response as JSON'); }

  return parsed
    .filter(q => q.question && Array.isArray(q.options) && q.options.length === 4
                 && typeof q.correctIndex === 'number')
    .slice(0, count)
    .map(q => ({
      question:     q.question,
      options:      q.options.map(String),
      correctIndex: Math.min(3, Math.max(0, q.correctIndex)),
    }));
}
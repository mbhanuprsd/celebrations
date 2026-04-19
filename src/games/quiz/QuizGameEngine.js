// src/games/quiz/QuizGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initQuizGame } from './quizFirebaseService';
import { generateQuizQuestions } from './quizGeminiService';
import { QUIZ_SETTINGS } from './quizConstants';

export class QuizGameEngine extends GameEngine {
  static get name() { return 'Quiz'; }
  static get description() { return 'Answer AI-generated trivia questions fastest to score!'; }
  static get playerRange() { return { min: 2, max: 12 }; }
  static get defaultSettings() {
    return {
      maxPlayers: 12,
      questionCount: QUIZ_SETTINGS.questionCount,
      answerTime: QUIZ_SETTINGS.answerTime,
      topic: 'general',
    };
  }

  async onStartGame(playerOrder) {
    const topic = this.room.settings?.topic || 'general';
    const count = this.room.settings?.questionCount || QUIZ_SETTINGS.questionCount;
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    const questions = await generateQuizQuestions(topic, count, apiKey);
    if (!questions.length) throw new Error('Failed to generate questions');

    await initQuizGame(this.roomId, playerOrder, questions, topic);
  }
}

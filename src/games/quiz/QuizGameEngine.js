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
      topic: 'General Knowledge',
    };
  }

  async onStartGame(playerOrder) {
    const topic = this.room.settings?.topic || 'General Knowledge';
    const count = this.room.settings?.questionCount || QUIZ_SETTINGS.questionCount;

    // Use pre-generated questions from Lobby if available (instant start)
    let questions = this.room.quizQuestions;

    if (!questions?.length) {
      // Fallback: generate now (e.g. if lobby pre-gen failed or was skipped)
      console.info('No pre-generated questions found — generating now…');
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      questions = await generateQuizQuestions(topic, count, apiKey);
    } else {
      console.info(`✅ Using ${questions.length} pre-generated questions from lobby.`);
    }

    await initQuizGame(this.roomId, playerOrder, questions, topic);
  }
}

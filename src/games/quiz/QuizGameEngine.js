// src/games/quiz/QuizGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initQuizGame } from './quizFirebaseService';
import { generateQuizQuestions } from './quizGroqService';
import { QUIZ_SETTINGS } from './quizConstants';
import { loadQuizAnswerKey } from './quizAnswerKey';

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

    // Use pre-generated questions from Lobby if available (instant start, no extra API call)
    let questions;
    const publicQuestions = this.room.quizQuestions;
    const answerKey = loadQuizAnswerKey(this.roomId, publicQuestions);

    if (publicQuestions?.length && answerKey?.length === publicQuestions.length) {
      questions = publicQuestions.map((question, index) => ({
        ...question,
        correctIndex: answerKey[index],
      }));
    } else if (publicQuestions?.some(question => Number.isInteger(question.correctIndex))) {
      questions = publicQuestions;
    } else {
      // Fallback: generate now (e.g. if lobby pre-gen failed or was skipped)
      console.info('No local answer key found — generating a fresh quiz for the host.');
      const apiKey = process.env.REACT_APP_GROQ_API_KEY;
      questions = await generateQuizQuestions(topic, count, apiKey);
    }

    // Initialize the game with the questions
    await initQuizGame(this.roomId, playerOrder, questions, topic);
  }
}

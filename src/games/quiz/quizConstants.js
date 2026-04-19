// src/games/quiz/quizConstants.js

export const QUIZ_TOPICS = [
  { id: 'general',    label: 'General Knowledge', icon: '🌍', color: '#4CC9F0' },
  { id: 'science',    label: 'Science',            icon: '🔬', color: '#06D6A0' },
  { id: 'history',    label: 'History',            icon: '🏛️',  color: '#FFB703' },
  { id: 'geography',  label: 'Geography',          icon: '🗺️',  color: '#FB8500' },
  { id: 'sports',     label: 'Sports',             icon: '⚽',  color: '#8338EC' },
  { id: 'movies',     label: 'Movies & TV',        icon: '🎬',  color: '#FF006E' },
  { id: 'music',      label: 'Music',              icon: '🎵',  color: '#3A86FF' },
  { id: 'technology', label: 'Technology',         icon: '💻',  color: '#7209B7' },
  { id: 'food',       label: 'Food & Drink',       icon: '🍕',  color: '#FB5607' },
  { id: 'nature',     label: 'Nature',             icon: '🌿',  color: '#2DC653' },
];

export const TOPIC_MAP = Object.fromEntries(QUIZ_TOPICS.map(t => [t.id, t]));

export const QUIZ_SETTINGS = {
  minPlayers: 2,
  maxPlayers: 12,
  questionCount: 8,
  answerTime: 20,
  revealTime: 4,
  maxScore: 1000,
};

export const POINTS_PER_SECOND = Math.floor(QUIZ_SETTINGS.maxScore / QUIZ_SETTINGS.answerTime);
export const OPTION_LABELS = ['A', 'B', 'C', 'D'];
export const OPTION_COLORS = ['#3A86FF', '#FF006E', '#FB5607', '#06D6A0'];

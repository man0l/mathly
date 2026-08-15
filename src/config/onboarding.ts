export interface QuizOption {
  label: string;
  sub?: string;
  emoji?: string;
}

export interface QuizStep {
  key: 'subjects' | 'level' | 'goal' | 'stuckOn' | 'explainStyle';
  question: string;
  sub: string;
  multi: boolean;
  options: QuizOption[];
}

export const QUIZ_STEPS: QuizStep[] = [
  {
    key: 'subjects',
    question: 'What do you need help with?',
    sub: 'Pick everything that applies — we will tune your tutor to it.',
    multi: true,
    options: [
      { label: 'Algebra', emoji: '🧮' },
      { label: 'Calculus', emoji: '∫' },
      { label: 'Geometry', emoji: '📐' },
      { label: 'Statistics', emoji: '📊' },
      { label: 'Physics', emoji: '🚀' },
      { label: 'Chemistry', emoji: '⚗️' },
    ],
  },
  {
    key: 'level',
    question: 'What are you studying right now?',
    sub: 'This sets how deep each explanation goes.',
    multi: false,
    options: [
      { label: 'Middle school' },
      { label: 'High school' },
      { label: 'College' },
      { label: 'University' },
      { label: 'Just for fun' },
    ],
  },
  {
    key: 'goal',
    question: 'What is your main goal?',
    sub: 'Be honest — it changes how we answer.',
    multi: false,
    options: [
      { label: 'Pass my exams', sub: 'Focus on method + marks' },
      { label: 'Finish homework faster', sub: 'Straight to the point' },
      { label: 'Actually understand', sub: 'Nothing skipped' },
      { label: 'Stay ahead of class', sub: 'Preview what is next' },
    ],
  },
  {
    key: 'stuckOn',
    question: 'Where do you usually get stuck?',
    sub: 'Your tutor will watch for exactly this.',
    multi: true,
    options: [
      { label: 'Starting a problem', sub: 'Blank page syndrome' },
      { label: 'Word problems', sub: 'Turning words into equations' },
      { label: 'Silly mistakes', sub: 'Signs, arithmetic, copying' },
      { label: 'Remembering formulas' },
      { label: 'Time pressure', sub: 'Exams feel too fast' },
    ],
  },
  {
    key: 'explainStyle',
    question: 'How do you like explanations?',
    sub: 'You can change this anytime.',
    multi: false,
    options: [
      { label: 'Quick answer first', emoji: '⚡', sub: 'Then the steps if you want' },
      { label: 'Step by step', emoji: '🪜', sub: 'Nothing skipped, in order' },
      { label: 'Visual', emoji: '📈', sub: 'Graphs and drawings when possible' },
      { label: 'Real-world examples', emoji: '🌍', sub: 'Connect it to something' },
    ],
  },
];

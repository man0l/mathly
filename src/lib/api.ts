import type { ChatMessage, OnboardingProfile, Solution, SubjectId } from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const E2E = process.env.EXPO_PUBLIC_E2E === '1';
const STUB = process.env.EXPO_PUBLIC_E2E_STUB_API === '1';

export const isE2EStubbed = () => STUB;

export interface SolveInput {
  text?: string;
  imageBase64?: string;
  photoUri?: string;
  profile: OnboardingProfile | null;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const STUB_SOLUTION: Solution = {
  id: 'stub-1',
  createdAt: new Date().toISOString(),
  problemText: 'Solve 2x² − 5x − 3 = 0',
  subject: 'algebra',
  finalAnswer: 'x = 3 or x = −1/2',
  method: 'Quadratic formula',
  concepts: ['Quadratic equations', 'Factoring', 'Zero product property'],
  source: 'scan',
  steps: [
    {
      title: 'Identify the coefficients',
      expression: 'a = 2, b = −5, c = −3',
      detail:
        'Compare with the standard form ax² + bx + c = 0. Here a is 2, b is −5 and c is −3. The equation cannot be factored easily, so the quadratic formula is the reliable route.',
    },
    {
      title: 'Write the quadratic formula',
      expression: 'x = (−b ± √(b² − 4ac)) / 2a',
      detail:
        'The formula gives both roots of any quadratic equation. Substitute the coefficients into it next — keep the ± sign, it produces two answers.',
    },
    {
      title: 'Compute the discriminant',
      expression: 'b² − 4ac = 25 + 24 = 49',
      detail:
        'The discriminant is 49, a positive perfect square. That means two distinct real roots — and √49 = 7, so the arithmetic stays clean.',
    },
    {
      title: 'Substitute and simplify',
      expression: 'x = (5 ± 7) / 4',
      detail:
        'With −b = 5 and √49 = 7, the formula collapses to (5 ± 7)/4. Split it into the two cases: plus gives 12/4, minus gives −2/4.',
    },
    {
      title: 'Write both solutions',
      expression: 'x = 3 or x = −1/2',
      detail:
        '12/4 = 3 and −2/4 = −1/2. Check by substituting back: 2(3)² − 5(3) − 3 = 0 ✓ and 2(−1/2)² − 5(−1/2) − 3 = 0 ✓.',
    },
  ],
  graph: { expression: '2*x^2 - 5*x - 3', xMin: -2, xMax: 4 },
  followUps: [],
};

const STUB_CHAT_REPLIES = [
  'Great question. Think of the ± sign as two separate equations sharing one formula — one uses +, the other −. That is why a quadratic has up to two real roots.',
  'Try checking the answer yourself: substitute x = 3 back into 2x² − 5x − 3. You should get exactly 0 — that is the habit that catches mistakes on exams.',
  'The discriminant b² − 4ac tells you the story before you solve: positive means two real roots, zero means one repeated root, negative means the roots are complex.',
];

export async function solveProblem(input: SolveInput): Promise<Solution> {
  if (STUB) {
    await sleep(2200);
    return {
      ...STUB_SOLUTION,
      id: uid(),
      createdAt: new Date().toISOString(),
      source: input.imageBase64 || input.photoUri ? 'scan' : 'text',
    };
  }

  const res = await fetch(`${API_BASE}/api/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      imageBase64: input.imageBase64,
      profile: input.profile,
    }),
  });
  if (!res.ok) throw new Error(`Solve failed (${res.status})`);
  const data = await res.json();
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    problemText: data.problemText,
    subject: (data.subject ?? 'other') as SubjectId,
    finalAnswer: data.finalAnswer,
    method: data.method,
    steps: data.steps ?? [],
    graph: data.graph,
    concepts: data.concepts,
    source: input.imageBase64 || input.photoUri ? 'scan' : 'text',
    followUps: [],
  };
}

export interface ChatInput {
  messages: ChatMessage[];
  profile: OnboardingProfile | null;
  solutionContext?: { problemText: string; finalAnswer: string };
}

export async function chatReply(input: ChatInput): Promise<string> {
  if (STUB) {
    await sleep(1600);
    const n = input.messages.filter((m) => m.role === 'user').length;
    return STUB_CHAT_REPLIES[(n - 1 + STUB_CHAT_REPLIES.length) % STUB_CHAT_REPLIES.length];
  }

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: input.messages.map((m) => ({ role: m.role, text: m.text })),
      profile: input.profile,
      solutionContext: input.solutionContext,
    }),
  });
  if (!res.ok) throw new Error(`Chat failed (${res.status})`);
  const data = await res.json();
  return data.reply as string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const e2e = { enabled: E2E };

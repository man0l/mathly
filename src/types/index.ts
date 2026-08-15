export type SubjectId =
  | 'algebra'
  | 'calculus'
  | 'geometry'
  | 'statistics'
  | 'physics'
  | 'chemistry'
  | 'trigonometry'
  | 'other';

export interface SolutionStep {
  title: string;
  expression?: string;
  detail: string;
}

export interface GraphSpec {
  /** ASCII expression of y in terms of x, e.g. "x^2 - 4". */
  expression: string;
  xMin: number;
  xMax: number;
  label?: string;
}

export interface Solution {
  id: string;
  createdAt: string;
  problemText: string;
  subject: SubjectId;
  finalAnswer: string;
  method?: string;
  steps: SolutionStep[];
  graph?: GraphSpec;
  concepts?: string[];
  source: 'scan' | 'text';
  photoUri?: string;
  followUps: FollowUpMessage[];
}

export interface FollowUpMessage {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  createdAt: string;
  photoUri?: string;
}

export interface OnboardingProfile {
  subjects: string[];
  level: string;
  goal: string;
  stuckOn: string[];
  explainStyle: string;
}

export interface SolveRequest {
  text?: string;
  imageBase64?: string;
  profile: OnboardingProfile;
}

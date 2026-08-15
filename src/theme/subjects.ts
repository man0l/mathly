import { colors } from './tokens';
import type { SubjectId } from '../types';

export interface SubjectMeta {
  id: SubjectId;
  label: string;
  emoji: string;
  tint: string;
  tintSoft: string;
}

export const SUBJECTS: SubjectMeta[] = [
  { id: 'algebra', label: 'Algebra', emoji: '🧮', tint: colors.accent, tintSoft: colors.accentSoft },
  { id: 'calculus', label: 'Calculus', emoji: '∫', tint: colors.accent2, tintSoft: 'rgba(77, 124, 254, 0.14)' },
  { id: 'geometry', label: 'Geometry', emoji: '📐', tint: colors.cyan, tintSoft: colors.cyanSoft },
  { id: 'statistics', label: 'Statistics', emoji: '📊', tint: colors.mint, tintSoft: colors.mintSoft },
  { id: 'physics', label: 'Physics', emoji: '🚀', tint: colors.amber, tintSoft: colors.amberSoft },
  { id: 'chemistry', label: 'Chemistry', emoji: '⚗️', tint: colors.rose, tintSoft: colors.roseSoft },
];

const OTHER_META: SubjectMeta = {
  id: 'other',
  label: 'Math',
  emoji: '∑',
  tint: colors.textSecondary,
  tintSoft: 'rgba(154, 163, 188, 0.12)',
};

export function subjectMeta(id: SubjectId): SubjectMeta {
  return SUBJECTS.find((s) => s.id === id) ?? OTHER_META;
}

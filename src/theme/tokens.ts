// Mathly design tokens — dark-first, indigo→blue accent, mint success.
export const colors = {
  bg: '#0B0E17',
  bgElevated: '#10142266',
  surface: '#141929',
  surfaceHover: '#1A2033',
  surfaceActive: '#202743',
  card: '#151A2C',
  border: 'rgba(148, 163, 204, 0.14)',
  borderStrong: 'rgba(148, 163, 204, 0.26)',

  text: '#F2F4FB',
  textSecondary: '#9AA3BC',
  textTertiary: '#667089',

  accent: '#7C5CFC',
  accent2: '#4D7CFE',
  accentSoft: 'rgba(124, 92, 252, 0.16)',
  accentBorder: 'rgba(124, 92, 252, 0.38)',

  mint: '#3DDC97',
  mintSoft: 'rgba(61, 220, 151, 0.14)',
  amber: '#FFB86B',
  amberSoft: 'rgba(255, 184, 107, 0.14)',
  rose: '#FF6B81',
  roseSoft: 'rgba(255, 107, 129, 0.13)',
  cyan: '#4DD3F7',
  cyanSoft: 'rgba(77, 211, 247, 0.13)',
} as const;

export const gradients = {
  brand: [colors.accent, colors.accent2] as [string, string],
  hero: ['#5B3DF5', '#4D7CFE'] as [string, string],
  answerRing: ['#7C5CFC', '#4D7CFE', '#3DDC97'] as [string, string, string],
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

/** Keep readable columns on iPad instead of stretching phone layouts edge-to-edge. */
export const layout = {
  contentMaxWidth: 560,
} as const;

export const typography = {
  display: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, lineHeight: 40, color: colors.text },
  h1: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, lineHeight: 34, color: colors.text },
  h2: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, lineHeight: 28, color: colors.text },
  h3: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 23, color: colors.text },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: colors.text },
  bodySecondary: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  small: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  button: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  mono: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 17, lineHeight: 24, color: colors.text },
} as const;

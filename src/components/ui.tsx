import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, radius, typography } from '../theme/tokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  testID,
}: ButtonProps) {
  const body = (
    <View style={styles.buttonRow}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : null}
      <Text style={[typography.button, variant === 'ghost' ? styles.ghostLabel : null]}>{label}</Text>
    </View>
  );

  const inactive = !!(disabled || loading);

  if (variant === 'primary') {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive }}
        hitSlop={4}
        style={({ pressed }) => [
          styles.base,
          styles.primaryShadow,
          pressed && !inactive && styles.pressed,
          inactive && styles.disabled,
          style,
        ]}
      >
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {body}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' ? styles.secondary : styles.ghost,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
  tint,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tint?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        selected && (tint ? { borderColor: tint, backgroundColor: `${tint}22` } : styles.chipSelected),
        pressed && styles.pressed,
      ]}
    >
      <Text style={[typography.caption, { color: selected ? (tint ?? colors.text) : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.small, styles.sectionTitle, style]}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    borderRadius: radius.md,
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryShadow: {
    shadowColor: '#7C5CFC',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  ghost: { paddingVertical: 12, paddingHorizontal: 8 },
  ghostLabel: { ...typography.button, color: colors.textSecondary },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(21, 26, 44, 0.7)',
  },
  chipSelected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.14,
    fontWeight: '700',
  },
  divider: { height: 1, backgroundColor: colors.border },
});

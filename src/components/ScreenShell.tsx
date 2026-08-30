import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation';

import { colors, layout, typography } from '../theme/tokens';
import { BackArrow } from './icons';

/** Centered column so iPad (and large web) keep a tappable, readable width. */
export function contentColumn(extra?: ViewStyle): ViewStyle {
  return {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    ...extra,
  };
}

export function ScreenShell({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.inner, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function BackHeader({ title, onBack }: { title?: string; onBack?: () => void }) {
  const navigation = useAppNavigation();
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => (onBack ? onBack() : navigation.goBack())}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
      >
        <BackArrow />
      </Pressable>
      {title ? <Text style={typography.h3}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1 },
  padded: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

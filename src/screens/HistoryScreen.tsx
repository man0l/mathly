import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation';

import { ChevronRight } from '../components/icons';
import { subjectMeta } from '../theme/subjects';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';
import type { Solution } from '../types';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSame = d.toDateString() === today.toDateString();
  if (isSame) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function HistoryScreen() {
  const navigation = useAppNavigation();
  const { solutions } = useApp();

  const sections = useMemo(() => {
    const map = new Map<string, Solution[]>();
    for (const s of solutions) {
      const label = dayLabel(s.createdAt);
      map.set(label, [...(map.get(label) ?? []), s]);
    }
    return [...map.entries()].map(([title, data]) => ({ title, data }));
  }, [solutions]);

  if (solutions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={typography.h2}>History</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 38 }}>📚</Text>
          <Text style={[typography.h3, { marginTop: 14 }]}>No problems yet</Text>
          <Text style={[typography.bodySecondary, { textAlign: 'center', marginTop: 8 }]}>
            Everything you scan or type is saved here, grouped by day.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <SectionList
        sections={sections}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}
        ListHeaderComponent={<Text style={typography.h2}>History</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
        )}
        renderSectionFooter={() => <View />}
        renderItem={({ item }) => {
          const meta = subjectMeta(item.subject);
          return (
            <Pressable
              onPress={() => navigation.navigate('Solution', { id: item.id })}
              accessibilityRole="button"
              accessibilityLabel={item.problemText}
              style={styles.row}
            >
              <View style={[styles.icon, { backgroundColor: meta.tintSoft }]}>
                <Text style={{ fontSize: 17 }}>{meta.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={typography.body} numberOfLines={1}>
                  {item.problemText}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[typography.small, { color: meta.tint }]} numberOfLines={1}>
                    {item.finalAnswer}
                  </Text>
                  <Text style={typography.small}>·</Text>
                  <Text style={typography.small}>
                    {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} />
            </Pressable>
          );
        }}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  sectionLabel: {
    ...typography.small,
    letterSpacing: 0.14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

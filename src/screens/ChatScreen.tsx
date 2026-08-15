import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation';

import { ImageIcon, SendIcon, SparkIcon } from '../components/icons';
import { chatReply } from '../lib/api';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';
import type { ChatMessage } from '../types';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

const STARTERS = [
  'Explain the quadratic formula',
  'When do I use integration by parts?',
  'Difference between mean and median?',
  'Help me set up a physics problem',
];

export function ChatScreen() {
  const navigation = useAppNavigation();
  const { chat, setChat, profile } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);

    const userMsg: ChatMessage = {
      id: `u-${uid()}`,
      role: 'user',
      text,
      createdAt: nowIso(),
    };
    const optimistic = [...chat, userMsg];
    await setChat(optimistic);

    try {
      const reply = await chatReply({ messages: optimistic, profile });
      await setChat([
        ...optimistic,
        { id: `t-${uid()}`, role: 'tutor', text: reply, createdAt: new Date().toISOString() },
      ]);
    } catch {
      await setChat([
        ...optimistic,
        {
          id: `t-${uid()}`,
          role: 'tutor',
          text: 'I lost the connection for a second — send that again?',
          createdAt: nowIso(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.tutorAvatar}>
              <SparkIcon size={17} color="#fff" />
            </View>
            <View>
              <Text style={typography.h3}>Your tutor</Text>
              <Text style={typography.small}>Always on · follows your style</Text>
            </View>
          </View>
        </View>

        {chat.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36 }}>💬</Text>
            <Text style={[typography.bodySecondary, { textAlign: 'center', marginTop: 10 }]}>
              Ask anything — concepts, homework, exam prep.{'\n'}Or snap a photo for a full solution.
            </Text>
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  accessibilityRole="button"
                  accessibilityLabel={s}
                  style={styles.starter}
                >
                  <Text style={[typography.caption, { color: colors.accent2 }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {chat.map((m) => (
              <View key={m.id} style={[styles.msgRow, m.role === 'user' ? styles.msgUser : null]}>
                {m.role === 'tutor' ? (
                  <View style={styles.tutorAvatarSmall}>
                    <SparkIcon size={12} color={colors.accent} />
                  </View>
                ) : null}
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleTutor]}>
                  <Text style={[typography.body, m.role === 'user' ? { color: '#fff' } : null]}>{m.text}</Text>
                </View>
              </View>
            ))}
            {busy ? (
              <View style={styles.msgRow}>
                <View style={styles.tutorAvatarSmall}>
                  <SparkIcon size={12} color={colors.accent} />
                </View>
                <View style={[styles.bubble, styles.bubbleTutor, styles.typing]}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.inputRow}>
          <Pressable
            onPress={() => navigation.navigate('Scanner')}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo of a problem"
            style={styles.attach}
          >
            <ImageIcon size={21} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Ask your tutor anything…"
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <Pressable onPress={() => send()} accessibilityRole="button" accessibilityLabel="Send" style={styles.send}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <SendIcon size={20} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tutorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 22 },
  starter: {
    borderWidth: 1,
    borderColor: 'rgba(77, 124, 254, 0.35)',
    backgroundColor: 'rgba(77, 124, 254, 0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  msgRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 7, alignItems: 'flex-end' },
  msgUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: 15, paddingVertical: 11 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  bubbleTutor: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  typing: { flexDirection: 'row', alignItems: 'center' },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  attach: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    minHeight: 46,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage, OnboardingProfile, Solution } from '../types';

const K_ONBOARDED = 'mathly-onboarded-v1';
const K_PROFILE = 'mathly-profile-v1';
const K_PROBLEMS = 'mathly-problems-v1';
const K_CHAT = 'mathly-chat-v1';
const K_PRO = 'mathly-pro-v1';

interface AppState {
  loaded: boolean;
  onboarded: boolean;
  profile: OnboardingProfile | null;
  solutions: Solution[];
  chat: ChatMessage[];
  isPro: boolean;
  completeOnboarding: (profile: OnboardingProfile) => Promise<void>;
  setPro: (value: boolean) => Promise<void>;
  addSolution: (solution: Solution) => Promise<void>;
  updateSolution: (id: string, patch: Partial<Solution>) => Promise<void>;
  deleteSolution: (id: string) => Promise<void>;
  setChat: (messages: ChatMessage[]) => Promise<void>;
  resetAll: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [chat, setChatState] = useState<ChatMessage[]>([]);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ob, p, probs, ch, pro] = await Promise.all([
          AsyncStorage.getItem(K_ONBOARDED),
          AsyncStorage.getItem(K_PROFILE),
          AsyncStorage.getItem(K_PROBLEMS),
          AsyncStorage.getItem(K_CHAT),
          AsyncStorage.getItem(K_PRO),
        ]);
        if (ob === '1') setOnboarded(true);
        if (p) setProfile(JSON.parse(p));
        if (probs) setSolutions(JSON.parse(probs));
        if (ch) setChatState(JSON.parse(ch));
        if (pro === '1') setIsPro(true);
      } catch {
        // corrupted storage — start fresh
      }
      setLoaded(true);
    })();
  }, []);

  const completeOnboarding = useCallback(async (p: OnboardingProfile) => {
    setProfile(p);
    setOnboarded(true);
    await AsyncStorage.multiSet([
      [K_ONBOARDED, '1'],
      [K_PROFILE, JSON.stringify(p)],
    ]);
  }, []);

  const setPro = useCallback(async (value: boolean) => {
    setIsPro(value);
    await AsyncStorage.setItem(K_PRO, value ? '1' : '0');
  }, []);

  const addSolution = useCallback(async (solution: Solution) => {
    setSolutions((prev) => {
      const next = [solution, ...prev].slice(0, 60);
      AsyncStorage.setItem(K_PROBLEMS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const updateSolution = useCallback(async (id: string, patch: Partial<Solution>) => {
    setSolutions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      AsyncStorage.setItem(K_PROBLEMS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const deleteSolution = useCallback(async (id: string) => {
    setSolutions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(K_PROBLEMS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setChat = useCallback(async (messages: ChatMessage[]) => {
    setChatState(messages);
    await AsyncStorage.setItem(K_CHAT, JSON.stringify(messages.slice(-80)));
  }, []);

  const resetAll = useCallback(async () => {
    await AsyncStorage.multiRemove([K_ONBOARDED, K_PROFILE, K_PROBLEMS, K_CHAT, K_PRO]);
    setOnboarded(false);
    setProfile(null);
    setSolutions([]);
    setChatState([]);
    setIsPro(false);
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      onboarded,
      profile,
      solutions,
      chat,
      isPro,
      completeOnboarding,
      setPro,
      addSolution,
      updateSolution,
      deleteSolution,
      setChat,
      resetAll,
    }),
    [loaded, onboarded, profile, solutions, chat, isPro, completeOnboarding, setPro, addSolution, updateSolution, deleteSolution, setChat, resetAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

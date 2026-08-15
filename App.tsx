import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { ChatIcon, HistoryIcon, ScanIcon, SettingsIcon } from './src/components/icons';
import { AnalyzingScreen } from './src/screens/AnalyzingScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ScanHomeScreen } from './src/screens/ScanHomeScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SolutionScreen } from './src/screens/SolutionScreen';
import { colors } from './src/theme/tokens';
import { AppProvider, useApp } from './src/state/AppProvider';
import { configurePurchases } from './src/lib/purchases';

export type RootStackParamList = {
  Tabs: undefined;
  Onboarding: undefined;
  Paywall: undefined;
  Scanner: undefined;
  Analyzing: { photoUri?: string; imageBase64?: string; text?: string };
  Solution: { id: string; error?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: '#10141F',
    border: 'rgba(148, 163, 204, 0.12)',
    text: colors.text,
    primary: colors.accent,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Scan"
        component={ScanHomeScreen}
        options={{
          tabBarIcon: ({ color }) => <ScanIcon size={23} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color }) => <HistoryIcon size={23} color={color} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ color }) => <ChatIcon size={23} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => <SettingsIcon size={23} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { loaded, onboarded, isPro } = useApp();

  useEffect(() => {
    configurePurchases();
  }, []);

  if (!loaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {onboarded && isPro ? (
        <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Group screenOptions={{ presentation: 'fullScreenModal' }}>
            <Stack.Screen name="Scanner" component={ScannerScreen} />
          </Stack.Group>
          <Stack.Screen name="Analyzing" component={AnalyzingScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Solution" component={SolutionScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Paywall" component={PaywallScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Scanner" component={ScannerScreen} />
          <Stack.Screen name="Analyzing" component={AnalyzingScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Solution" component={SolutionScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    backgroundColor: '#10141F',
    borderTopColor: 'rgba(148, 163, 204, 0.12)',
    height: Platform.OS === 'web' ? 64 : 88,
    paddingTop: 8,
  },
  tabLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});

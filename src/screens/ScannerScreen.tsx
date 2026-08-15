import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAppNavigation } from '../navigation';

import { e2e } from '../lib/api';
import { colors, radius, typography } from '../theme/tokens';
import { BackArrow, ImageIcon, TorchIcon } from '../components/icons';

const TEST_PHOTO_NOTE = 'Equation preview for testing';

export function ScannerScreen() {
  const navigation = useAppNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const [busy, setBusy] = useState(false);

  const goAnalyze = (photo?: { uri: string; base64?: string }) => {
    navigation.navigate('Analyzing', {
      photoUri: photo?.uri,
      imageBase64: photo?.base64,
    });
  };

  const analyzeTestPhoto = async () => {
    // E2E/web path: analyze the bundled handwritten problem. In live mode the
    // API needs pixels, so convert the asset to base64 (web fetch).
    let base64: string | undefined;
    try {
      const res = await fetch('/e2e/test-problem.png');
      const buf = await res.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      base64 = btoa(bin);
    } catch {
      // stub mode doesn't send pixels anyway
    }
    goAnalyze({ uri: '/e2e/test-problem.png', base64 });
  };

  const snap = async () => {
    setBusy(true);
    // In e2e/web mode there is no live capture — use the bundled test problem.
    if (e2e.enabled) {
      await new Promise((r) => setTimeout(r, 400));
      setBusy(false);
      await analyzeTestPhoto();
      return;
    }
    setBusy(false);
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      goAnalyze({ uri: res.assets[0].uri, base64: res.assets[0].base64 ?? undefined });
    }
  };

  const body = () => {
    if (!permission) {
      return <CenterLoader />;
    }
    if (!permission.granted) {
      return (
        <View style={styles.permissionBox}>
          <Text style={typography.h2}>Camera access needed</Text>
          <Text style={[typography.bodySecondary, { textAlign: 'center', marginTop: 10 }]}>
            Mathly uses the camera only to scan the problem you point it at. Nothing is recorded.
          </Text>
          <Pressable
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Allow camera access"
            style={styles.allowBtn}
          >
            <Text style={[typography.button, { color: '#fff' }]}>Allow camera access</Text>
          </Pressable>
          <Pressable
            onPress={pickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choose from photos instead"
          >
            <Text style={[typography.caption, { marginTop: 16 }]}>Choose from photos instead</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <CameraView style={styles.fill} facing={facing} flash={flash} />
    );
  };

  return (
    <View style={styles.root}>
      {body()}

      {/* Viewfinder overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame}>
          <Bracket corner="tl" />
          <Bracket corner="tr" />
          <Bracket corner="bl" />
          <Bracket corner="br" />
        </View>
        <Text style={styles.hint}>Fit the equation inside the frame</Text>
      </View>

      <SafeAreaView style={[styles.fill, styles.overlaySafe]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            style={styles.circleBtn}
          >
            <BackArrow size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
            accessibilityRole="button"
            accessibilityLabel="Toggle flash"
            style={styles.circleBtn}
          >
            <TorchIcon size={20} color={flash === 'on' ? colors.amber : '#fff'} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.bottomBar}>
          <Pressable
            onPress={pickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choose from photos"
            style={styles.circleBtn}
          >
            <ImageIcon size={22} color="#fff" />
          </Pressable>

          <Pressable
            testID="scanner-shutter"
            onPress={snap}
            accessibilityRole="button"
            accessibilityLabel="Capture problem"
            style={styles.shutterOuter}
            disabled={busy}
          >
            <View style={styles.shutterInner}>{busy ? <ActivityIndicator color="#fff" /> : null}</View>
          </Pressable>

          {e2e.enabled ? (
            <Pressable
              testID="e2e-use-test-photo"
              onPress={analyzeTestPhoto}
              accessibilityRole="button"
              accessibilityLabel="Use test photo"
              style={styles.circleBtn}
            >
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>TEST</Text>
            </Pressable>
          ) : (
            <View style={{ width: 56 }} />
          )}
        </View>
        {e2e.enabled ? (
          <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', paddingBottom: 10, fontSize: 11 }}>
            {TEST_PHOTO_NOTE}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function CenterLoader() {
  return (
    <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

function Bracket({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 44;
  const w = 5;
  const common = { position: 'absolute' as const, width: size, height: size };
  const pos =
    corner === 'tl'
      ? { top: -w / 2, left: -w / 2, borderTopLeftRadius: 14 }
      : corner === 'tr'
        ? { top: -w / 2, right: -w / 2, borderTopRightRadius: 14 }
        : corner === 'bl'
          ? { bottom: -w / 2, left: -w / 2, borderBottomLeftRadius: 14 }
          : { bottom: -w / 2, right: -w / 2, borderBottomRightRadius: 14 };
  const borders =
    corner === 'tl'
      ? { borderTopWidth: w, borderLeftWidth: w }
      : corner === 'tr'
        ? { borderTopWidth: w, borderRightWidth: w }
        : corner === 'bl'
          ? { borderBottomWidth: w, borderLeftWidth: w }
          : { borderBottomWidth: w, borderRightWidth: w };
  const colors2: Record<string, string> = {
    tl: colors.accent,
    tr: colors.accent2,
    bl: colors.accent2,
    br: colors.accent,
  };
  return (
    <View
      style={[common, pos, borders, { borderColor: colors2[corner] }]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070D' },
  fill: { flex: 1 },
  overlaySafe: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 7, 13, 0.35)',
  },
  frame: { width: 300, height: 190 },
  hint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 22,
    backgroundColor: 'rgba(5,7,13,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 18,
  },
  circleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(21, 26, 44, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.35)',
    padding: 4,
  },
  shutterInner: {
    flex: 1,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 6 },
  allowBtn: {
    marginTop: 22,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
});

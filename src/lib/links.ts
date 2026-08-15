import { Alert, Linking } from 'react-native';

/** Hosted legal pages (balkanbit Next.js site, app/mathly/*). */
export const LEGAL_LINKS = {
  privacy: 'https://balkanbit.app/mathly/privacy-policy',
  terms: 'https://balkanbit.app/mathly/terms',
  support: 'https://balkanbit.app/mathly/support',
} as const;

export function openLegalLink(which: keyof typeof LEGAL_LINKS) {
  Linking.openURL(LEGAL_LINKS[which]).catch(() => {
    Alert.alert('Could not open the page', LEGAL_LINKS[which]);
  });
}

import type { Page } from '@playwright/test';

export type AppDialog = { message: string };

/**
 * Collect the web stand-in for RN's Alert (window.alert) and auto-accept each
 * dialog so the flow keeps running. RN compiles Alert.alert to a no-op on
 * react-native-web, so the app routes its purchase/restore feedback through
 * window.alert there — these are exactly the messages the specs assert on.
 */
export function trackDialogs(page: Page): AppDialog[] {
  const seen: AppDialog[] = [];
  page.on('dialog', (dialog) => {
    seen.push({ message: dialog.message() });
    void dialog.accept();
  });
  return seen;
}

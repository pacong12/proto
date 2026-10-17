import { ref } from 'vue';
import {
  COOKIE_CONSENT_KEY,
  disableAnalytics,
  enableAnalytics,
  readCookieChoice,
  type CookieChoice,
} from './analytics';

/**
 * Terms of Service / Privacy Policy acceptance. Signing or sending anything with the wallet
 * requires it: see guardWalletWrites in viem-client.ts.
 */
export const TERMS_ACCEPTED_KEY = 'proto_privacy_policy_accepted_v1';

function readTermsAccepted(): boolean {
  try {
    return localStorage.getItem(TERMS_ACCEPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export const termsAccepted = ref(typeof window !== 'undefined' && readTermsAccepted());
/** Opens the terms dialog (App.vue). */
export const termsPromptOpen = ref(false);

export function acceptTerms(): void {
  termsAccepted.value = true;
  termsPromptOpen.value = false;
  try {
    localStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
  } catch {
    // Accepted for this session only.
  }
}

export class TermsNotAcceptedError extends Error {
  constructor() {
    super('Accept the Terms of Service and Privacy Policy to continue.');
    this.name = 'TermsNotAcceptedError';
  }
}

/** Throws (and opens the terms dialog) unless the terms were accepted. */
export function assertTermsAccepted(): void {
  if (termsAccepted.value) return;
  termsPromptOpen.value = true;
  throw new TermsNotAcceptedError();
}

/** Cookie choice: shown in the banner until the visitor accepts or declines. */
export const cookieChoice = ref<CookieChoice>(
  typeof window !== 'undefined' ? readCookieChoice() : null,
);
/** Reopens the banner from the footer "Cookie settings" link. */
export const cookieSettingsOpen = ref(false);

export function setCookieChoice(choice: Exclude<CookieChoice, null>): void {
  cookieChoice.value = choice;
  cookieSettingsOpen.value = false;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice === 'accepted' ? 'true' : 'false');
  } catch {
    // Applies to this session only.
  }
  if (choice === 'accepted') enableAnalytics();
  else disableAnalytics();
}

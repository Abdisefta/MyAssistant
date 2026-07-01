/**
 * Google Play Billing — stub until product is created in Play Console.
 * Subscription: My Assistant Pro, 199 SEK/month.
 *
 * PLACEHOLDER: Replace PRO_SUBSCRIPTION_SKU with the real product ID from Play Console
 * before enabling billing (Monetization → Subscriptions).
 */

/** Placeholder SKU — not registered in Play Console yet. */
export const PRO_SUBSCRIPTION_SKU = 'my_assistant_pro_monthly';
export const PRO_PRICE_SEK = 199;

export const PLAY_BILLING_COMING_SOON_MESSAGE =
  'Google Play-abonnemang kommer snart. Prova gratisperioden under tiden.';

export type BillingPurchaseState = 'unavailable' | 'not_purchased' | 'active' | 'pending';

export function isPlayBillingAvailable(): boolean {
  return false;
}

export async function getSubscriptionState(): Promise<BillingPurchaseState> {
  return 'unavailable';
}

export async function purchaseProSubscription(): Promise<{
  ok: boolean;
  message: string;
}> {
  return {
    ok: false,
    message: PLAY_BILLING_COMING_SOON_MESSAGE,
  };
}

export async function restorePurchases(): Promise<{
  ok: boolean;
  message: string;
}> {
  return {
    ok: false,
    message: 'Återställning av köp aktiveras när Play Billing är konfigurerat.',
  };
}

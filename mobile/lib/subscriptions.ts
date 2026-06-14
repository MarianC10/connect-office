import { authFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";
import * as ExpoLinking from "expo-linking";

export type SubscriptionPlanType = "entrances_10" | "monthly" | "yearly";

export type SubscriptionStatus = "active" | "expired" | "cancelled";

export type SubscriptionPlan = {
  plan_type: SubscriptionPlanType;
  name: string;
  perks: string[];
};

export type MySubscription = {
  plan_type: SubscriptionPlanType;
  status: SubscriptionStatus;
  entrances_remaining: number | null;
  entrances_total?: number | null;
  starts_at: string;
  expires_at?: string | null;
  perks: string[];
};

export class SubscriptionConflictError extends Error {
  constructor(message = "You already have an active subscription") {
    super(message);
    this.name = "SubscriptionConflictError";
  }
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const res = await authFetch("/subscriptions/plans");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchMySubscription(): Promise<MySubscription | null> {
  const res = await authFetch("/subscriptions/me");
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export function subscriptionCheckoutURLs() {
  const appSuccess = ExpoLinking.createURL("/profile/subscription", {
    queryParams: { checkout: "success" },
  });
  const appCancel = ExpoLinking.createURL("/profile/subscription", {
    queryParams: { checkout: "cancel" },
  });
  const returnBase = `${API_BASE_URL}/subscriptions/checkout-return`;

  return {
    successUrl: `${returnBase}?checkout=success&app_redirect=${encodeURIComponent(appSuccess)}`,
    cancelUrl: `${returnBase}?checkout=cancel&app_redirect=${encodeURIComponent(appCancel)}`,
    returnBase,
  };
}

export function parseCheckoutResult(url: string): "success" | "cancel" | null {
  const parsed = ExpoLinking.parse(url);
  const value = parsed.queryParams?.checkout;
  const checkout = Array.isArray(value) ? value[0] : value;
  if (checkout === "success" || checkout === "cancel") {
    return checkout;
  }
  return null;
}

export async function createSubscriptionCheckout(
  planType: SubscriptionPlanType,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const res = await authFetch("/subscriptions/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_type: planType,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });
  if (res.status === 409) {
    const text = await res.text();
    throw new SubscriptionConflictError(text || undefined);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data: { checkout_url: string } = await res.json();
  return data.checkout_url;
}

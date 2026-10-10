import "server-only";

import { effectivePlan, emptyUsage, periodStart, type UsageKind } from "@/lib/billing/plans";
import { check } from "@/lib/db/core";
import type { SubscriptionRow } from "@/lib/db/types";
import type { BillingContext } from "@/lib/db/usage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export { recordUsage } from "@/lib/db/usage";

/** Fakturačný kontext pre úlohy na pozadí (bez cookies používateľa). */
export async function getAdminBillingContext(userId: string, now = new Date()): Promise<BillingContext> {
  const admin = getSupabaseAdmin();
  const start = periodStart(now);
  const [subscriptionResult, usageResult] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle<SubscriptionRow>(),
    admin
      .from("usage_events")
      .select("kind, quantity")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .limit(10_000),
  ]);
  check(subscriptionResult, "usageAdmin.subscription");
  check(usageResult, "usageAdmin.usage");

  const usage = emptyUsage();
  for (const row of (usageResult.data ?? []) as Array<{ kind: UsageKind; quantity: number }>) {
    if (row.kind in usage) usage[row.kind] += row.quantity;
  }
  const subscription = subscriptionResult.data;
  return { plan: effectivePlan(subscription), subscription, usage, periodStart: start };
}

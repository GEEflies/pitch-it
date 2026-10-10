import { NextResponse } from "next/server";
import { getStripeConfig } from "@/config/server-env";
import { mapSubscriptionStatus, verifyWebhookSignature, type StripeSubscription } from "@/lib/billing/stripe";
import { trackEvent } from "@/lib/events/track";
import { getAdminDb } from "@/lib/store/client";
import { isUuid } from "@/lib/validation/ids";

/*
  Stripe webhook: zdroj pravdy o predplatnom. Overuje podpis, je idempotentný
  (zapisuje stav, nie prírastky) a nikdy neverí údajom z prehliadača.
*/

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

async function upsertFromSubscription(subscription: StripeSubscription, fallbackUserId: string | null) {
  const admin = getAdminDb();
  let userId = subscription.metadata?.user_id ?? fallbackUserId;
  if (!isUuid(userId)) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("provider_customer_id", subscription.customer)
      .maybeSingle<{ user_id: string }>();
    userId = data?.user_id ?? null;
  }
  if (!isUuid(userId)) {
    console.error("[billing] webhook bez používateľa pre subscription", subscription.id);
    return;
  }
  const status = mapSubscriptionStatus(subscription.status);
  const periodEnd = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end ?? null;
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: status === "canceled" ? "free" : "pro",
      status,
      provider: "stripe",
      provider_customer_id: subscription.customer,
      provider_subscription_id: subscription.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`subscriptions.upsert: ${error.message}`);
  return userId;
}

export async function POST(request: Request) {
  const config = getStripeConfig();
  if (!config) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const payload = await request.text();
  if (!verifyWebhookSignature(payload, request.headers.get("stripe-signature"), config.webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { client_reference_id?: string; customer?: string; subscription?: string };
      if (isUuid(session.client_reference_id) && typeof session.customer === "string") {
        await getAdminDb()
          .from("subscriptions")
          .update({ provider: "stripe", provider_customer_id: session.customer, provider_subscription_id: session.subscription ?? null })
          .eq("user_id", session.client_reference_id);
        await trackEvent(session.client_reference_id, "purchase_completed", { plan: "pro" });
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      await upsertFromSubscription(event.data.object as unknown as StripeSubscription, null);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing] webhook zlyhal:", error instanceof Error ? error.message : error);
    // 500 → Stripe udalosť doručí znova.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

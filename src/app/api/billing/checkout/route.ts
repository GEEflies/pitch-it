import { siteConfig } from "@/config/site";
import { createCheckoutSession, createPortalSession, isStripeConfigured, StripeError } from "@/lib/billing/stripe";
import { getSubscription } from "@/lib/db/usage";
import { trackEvent } from "@/lib/events/track";
import { apiError, apiOk, handleRouteError, requireApiUser } from "@/lib/http/route";

/** Presmerovanie na platbu (Pro) alebo do zákazníckeho portálu (správa predplatného). */
export async function POST() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  if (!isStripeConfigured()) return apiError(503, "not_configured", "Platby zatiaľ nie sú zapnuté.");

  try {
    const subscription = await getSubscription(user.id);
    const returnUrl = `${siteConfig.url}/app/nastavenia#plan`;
    if (subscription?.plan === "pro" && subscription.provider_customer_id && subscription.status !== "canceled") {
      return apiOk({ url: await createPortalSession(subscription.provider_customer_id, returnUrl) });
    }
    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      customerId: subscription?.provider_customer_id ?? null,
      successUrl: `${siteConfig.url}/app/nastavenia?platba=ok#plan`,
      cancelUrl: returnUrl,
    });
    await trackEvent(user.id, "checkout_started", {});
    return apiOk({ url });
  } catch (error) {
    if (error instanceof StripeError) {
      console.error("[billing]", error.message);
      return apiError(502, "billing_failed", "Platobnú bránu sa nepodarilo otvoriť. Skús to o chvíľu.");
    }
    return handleRouteError(error, "billing.checkout");
  }
}

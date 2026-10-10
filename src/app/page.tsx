import { LandingScreen } from "@/components/landing/landing-screen";
import { EarlyAccess } from "@/components/sections/early-access";
import { getSignupMode } from "@/config/env";
import { getPrimaryCta } from "@/config/site";

export default function Home() {
  const waitlist = getSignupMode() === "waitlist";
  return <LandingScreen cta={getPrimaryCta()} waitlist={waitlist ? <EarlyAccess /> : null} />;
}

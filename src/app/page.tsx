import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Demo } from "@/components/sections/demo";
import { EarlyAccess } from "@/components/sections/early-access";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCta } from "@/components/sections/final-cta";
import { getSignupMode } from "@/config/env";
import { getPrimaryCta } from "@/config/site";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Outcomes } from "@/components/sections/outcomes";
import { Pillars } from "@/components/sections/pillars";
import { Problem } from "@/components/sections/problem";

export default function Home() {
  const cta = getPrimaryCta();
  const waitlist = getSignupMode() === "waitlist";
  return (
    <>
      <SiteHeader cta={cta} />
      <main id="obsah">
        <Hero cta={cta} />
        <Problem />
        <HowItWorks />
        <Pillars />
        <Demo />
        <Outcomes />
        <FaqSection />
        {waitlist ? <EarlyAccess /> : <FinalCta cta={cta} />}
      </main>
      <SiteFooter />
    </>
  );
}

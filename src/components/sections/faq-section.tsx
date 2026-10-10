import { siteConfig } from "@/config/site";
import { FaqList } from "@/components/sections/faq";

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="relative border-t border-line/70 py-24 md:py-32"
    >
      <div className="container-page grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <h2
            id="faq-title"
            className="type-heading text-[clamp(2.1rem,1.4rem+2.8vw,3.5rem)]"
          >
            Časté otázky
          </h2>
          <p className="mt-5 max-w-[22rem] text-lg leading-relaxed text-mute">
            {siteConfig.contactEmail ? (
              <>
                Chýba ti odpoveď? Napíš nám na{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="link-underline text-paper"
                >
                  {siteConfig.contactEmail}
                </a>
                .
              </>
            ) : (
              "Čo vieme dnes a čo zatiaľ nie."
            )}
          </p>
        </div>
        <div className="lg:col-span-8">
          <FaqList />
        </div>
      </div>
    </section>
  );
}

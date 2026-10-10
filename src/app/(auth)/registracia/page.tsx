import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthPage, authAvailable } from "@/components/auth/auth-page";
import { EarlyAccessForm } from "@/components/sections/early-access-form";
import { getSignupMode } from "@/config/env";
import { isEarlyAccessConfigured } from "@/lib/early-access/store";

export const metadata: Metadata = {
  title: "Registrácia",
  description: "Vytvor si účet a natrénuj investorské stretnutie na vlastných podkladoch.",
};

const DEFAULT_DESCRIPTION = "Začni zadarmo. Netreba kreditnú kartu.";

// searchParams sú runtime dáta: čítame ich až za Suspense, zvyšok stránky ostáva statický
async function SignUpDescription({ searchParams }: { searchParams: PageProps<"/registracia">["searchParams"] }) {
  return (await searchParams)["stary-ucet"] === "1"
    ? "Po aktualizácii sme tvoj predošlý účet nenašli. Prepáč, zaregistruj sa prosím znova, tentoraz sa už všetko uloží."
    : DEFAULT_DESCRIPTION;
}

export default function SignUpPage({ searchParams }: PageProps<"/registracia">) {
  if (getSignupMode() === "waitlist") {
    return (
      <AuthPage
        title="Zatiaľ púšťame po skupinách."
        description="Hlasový tréning stojí reálne peniaze, preto účty otvárame postupne. Zapíš sa a ozveme sa, keď príde rad na teba."
      >
        <EarlyAccessForm available={isEarlyAccessConfigured()} setupHint={null} />
      </AuthPage>
    );
  }

  return (
    <AuthPage
      title="Vytvor si účet."
      description={
        <Suspense fallback={DEFAULT_DESCRIPTION}>
          <SignUpDescription searchParams={searchParams} />
        </Suspense>
      }
      footer={
        <>
          Už máš účet?{" "}
          <Link href="/prihlasenie" className="font-bold text-accent hover:underline">
            Prihlásiť sa
          </Link>
        </>
      }
    >
      <SignUpForm available={authAvailable()} />
    </AuthPage>
  );
}

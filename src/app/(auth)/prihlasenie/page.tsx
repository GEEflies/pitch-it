import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/auth-forms";
import { AuthPage, authAvailable } from "@/components/auth/auth-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Prihlásenie",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <AuthPage
      title="Vitaj späť."
      description="Prihlás sa a pokračuj v cvičení svojho pitchu."
      footer={
        <>
          Ešte nemáš účet?{" "}
          <Link href="/registracia" className="font-bold text-accent hover:underline">
            Vytvoriť účet
          </Link>
        </>
      }
    >
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SignInForm available={authAvailable()} />
      </Suspense>
    </AuthPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/components/auth/auth-forms";
import { AuthPage, authAvailable } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Zabudnuté heslo",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthPage
      title="Nové heslo."
      description="Zadaj e-mail k účtu. Pošleme ti odkaz, cez ktorý si nastavíš nové heslo."
      footer={
        <Link href="/prihlasenie" className="font-bold text-accent hover:underline">
          Späť na prihlásenie
        </Link>
      }
    >
      <ResetRequestForm available={authAvailable()} />
    </AuthPage>
  );
}

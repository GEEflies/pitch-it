import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/auth-forms";
import { AuthPage, authAvailable } from "@/components/auth/auth-page";

export const metadata: Metadata = {
  title: "Nastavenie hesla",
  robots: { index: false },
};

export default function NewPasswordPage() {
  return (
    <AuthPage title="Nastav si nové heslo." description="Po uložení ťa rovno prihlásime.">
      <NewPasswordForm available={authAvailable()} />
    </AuthPage>
  );
}

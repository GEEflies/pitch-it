"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset, signIn, signInWithProvider, signUp, updatePassword } from "@/lib/auth/actions";
import { initialAuthState, PASSWORD_MIN_LENGTH, type AccountType, type OAuthProvider } from "@/lib/auth/schemas";

function FormMessage({ status, message }: { status: string; message?: string }) {
  if (!message) return null;
  return (
    <Notice tone={status === "success" ? "success" : "error"} role={status === "success" ? "status" : "alert"}>
      {message}
    </Notice>
  );
}

const LINK_ERRORS: Record<string, string> = {
  odkaz: "Odkaz z e-mailu je neplatný alebo vypršal. Prihlás sa alebo si vypýtaj nový.",
  poskytovatel: "Prihlásenie cez tento účet sa nepodarilo. Skús to znova alebo použi e-mail.",
};

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Pokračovať cez Google",
  linkedin_oidc: "Pokračovať cez LinkedIn",
};

function Separator() {
  return (
    <div className="mt-6 mb-3.5 flex items-center gap-3 text-[13px] text-mute" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      alebo
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function ProviderButtons({ providers, next, disabled }: { providers: OAuthProvider[]; next?: string; disabled?: boolean }) {
  return (
    <>
      <Separator />
      {providers.map((provider) => (
        <form key={provider} action={signInWithProvider} className="mt-2.5">
          <input type="hidden" name="provider" value={provider} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button type="submit" disabled={disabled} className={buttonClasses({ variant: "secondary", className: "min-h-12 w-full" })}>
            {PROVIDER_LABELS[provider]}
          </button>
        </form>
      ))}
    </>
  );
}

export function SignInForm({ available }: { available: boolean }) {
  const [state, action] = useActionState(signIn, initialAuthState);
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const linkError = LINK_ERRORS[params.get("chyba") ?? ""];
  const id = useId();

  return (
    <>
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        {linkError && state.status === "idle" ? <Notice tone="attention">{linkError}</Notice> : null}
        {params.get("heslo") === "zmenene" ? <Notice tone="success">Heslo je zmenené.</Notice> : null}
        <FormMessage status={state.status} message={state.message} />
        <Field id={`${id}-email`} label="E-mail" error={state.fieldErrors?.email}>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ty@startup.sk"
            required
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />
        </Field>
        <Field id={`${id}-password`} label="Heslo" error={state.fieldErrors?.password}>
          <Input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Tvoje heslo"
            required
            error={state.fieldErrors?.password}
          />
        </Field>
        <div className="!mt-3 mb-6 text-right text-sm">
          <Link href="/zabudnute-heslo" className="text-accent hover:underline">
            Zabudnuté heslo?
          </Link>
        </div>
        <SubmitButton pendingLabel="Prihlasujem…" disabled={!available} className="min-h-[52px] w-full">
          Prihlásiť sa
        </SubmitButton>
      </form>
      <ProviderButtons providers={["google", "linkedin_oidc"]} next={next} disabled={!available} />
    </>
  );
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "participant", label: "Účastník" },
  { value: "organizer", label: "Organizátor" },
];

export function SignUpForm({ available }: { available: boolean }) {
  const [state, action] = useActionState(signUp, initialAuthState);
  const [accountType, setAccountType] = useState<AccountType>("participant");
  const id = useId();

  if (state.status === "success") {
    return (
      <Notice tone="success" title="Skontroluj e-mail">
        {state.message}
      </Notice>
    );
  }

  return (
    <>
      <form action={action} className="space-y-4" noValidate>
        <FormMessage status={state.status} message={state.message} />
        <input type="hidden" name="account_type" value={accountType} />
        <div role="group" aria-label="Typ účtu" className="mt-[22px] mb-1 flex gap-1 rounded-full border border-line bg-ink p-1">
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={accountType === option.value}
              onClick={() => setAccountType(option.value)}
              className={`min-h-11 flex-1 rounded-full px-3.5 py-2.5 text-sm font-bold transition-colors ${
                accountType === option.value ? "bg-signal text-on-signal" : "text-mute hover:text-paper"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Field id={`${id}-name`} label="Celé meno" error={state.fieldErrors?.display_name}>
          <Input
            id={`${id}-name`}
            name="display_name"
            autoComplete="name"
            placeholder="Tvoje meno"
            maxLength={80}
            defaultValue={state.values?.display_name}
            error={state.fieldErrors?.display_name}
          />
        </Field>
        <Field id={`${id}-email`} label="Pracovný e-mail" error={state.fieldErrors?.email}>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ty@startup.sk"
            required
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />
        </Field>
        <Field id={`${id}-password`} label="Heslo" error={state.fieldErrors?.password}>
          <Input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={`Aspoň ${PASSWORD_MIN_LENGTH} znakov`}
            minLength={PASSWORD_MIN_LENGTH}
            required
            error={state.fieldErrors?.password}
          />
        </Field>
        <Checkbox
          id={`${id}-terms`}
          name="accept_terms"
          className="!mt-[22px] mb-6"
          error={state.fieldErrors?.accept_terms}
          label={
            <>
              Súhlasím s{" "}
              <Link href="/podmienky" className="text-paper underline-offset-2 hover:underline" target="_blank">
                Podmienkami
              </Link>{" "}
              a{" "}
              <Link href="/ochrana-osobnych-udajov" className="text-paper underline-offset-2 hover:underline" target="_blank">
                Zásadami ochrany súkromia
              </Link>{" "}
              a mám aspoň 18 rokov. Moje nahrávky sa nikdy nezdieľajú bez môjho súhlasu.
            </>
          }
        />
        <SubmitButton pendingLabel="Vytváram účet…" disabled={!available} className="min-h-[52px] w-full">
          Vytvoriť účet
        </SubmitButton>
      </form>
      <ProviderButtons providers={["google"]} next="/app" disabled={!available} />
    </>
  );
}

export function ResetRequestForm({ available }: { available: boolean }) {
  const [state, action] = useActionState(requestPasswordReset, initialAuthState);
  const id = useId();
  if (state.status === "success") return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field id={`${id}-email`} label="E-mail" error={state.fieldErrors?.email}>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
      </Field>
      <SubmitButton pendingLabel="Posielam…" disabled={!available} className="min-h-[52px] w-full">
        Poslať odkaz
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ available }: { available: boolean }) {
  const [state, action] = useActionState(updatePassword, initialAuthState);
  const id = useId();
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field id={`${id}-password`} label="Nové heslo" hint={`Aspoň ${PASSWORD_MIN_LENGTH} znakov.`} error={state.fieldErrors?.password}>
        <Input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          hint={`Aspoň ${PASSWORD_MIN_LENGTH} znakov.`}
          error={state.fieldErrors?.password}
        />
      </Field>
      <Field id={`${id}-confirm`} label="Nové heslo ešte raz" error={state.fieldErrors?.password_confirm}>
        <Input
          id={`${id}-confirm`}
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.password_confirm}
        />
      </Field>
      <SubmitButton pendingLabel="Ukladám…" disabled={!available} className="min-h-[52px] w-full">
        Nastaviť heslo
      </SubmitButton>
    </form>
  );
}

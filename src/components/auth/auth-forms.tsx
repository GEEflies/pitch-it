"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { useSearchParams } from "next/navigation";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/auth/actions";
import { initialAuthState, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

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
};

export function SignInForm({ available }: { available: boolean }) {
  const [state, action] = useActionState(signIn, initialAuthState);
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const linkError = LINK_ERRORS[params.get("chyba") ?? ""];
  const id = useId();

  return (
    <form action={action} className="space-y-5" noValidate>
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
          required
          error={state.fieldErrors?.password}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <SubmitButton pendingLabel="Prihlasujem…" disabled={!available}>
          Prihlásiť sa
        </SubmitButton>
        <Link href="/zabudnute-heslo" className="link-underline text-sm text-mute hover:text-paper">
          Zabudnuté heslo
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm({ available }: { available: boolean }) {
  const [state, action] = useActionState(signUp, initialAuthState);
  const id = useId();

  if (state.status === "success") {
    return (
      <Notice tone="success" title="Skontroluj e-mail">
        {state.message}
      </Notice>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field id={`${id}-name`} label="Ako ťa máme oslovovať" optional error={state.fieldErrors?.display_name}>
        <Input
          id={`${id}-name`}
          name="display_name"
          autoComplete="given-name"
          maxLength={80}
          defaultValue={state.values?.display_name}
          error={state.fieldErrors?.display_name}
        />
      </Field>
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
      <Field
        id={`${id}-password`}
        label="Heslo"
        hint={`Aspoň ${PASSWORD_MIN_LENGTH} znakov.`}
        error={state.fieldErrors?.password}
      >
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
      <div className="space-y-3 border-t border-line/70 pt-5">
        <Checkbox
          id={`${id}-terms`}
          name="accept_terms"
          error={state.fieldErrors?.accept_terms}
          label={
            <>
              Súhlasím s{" "}
              <Link href="/podmienky" className="link-underline text-paper" target="_blank">
                podmienkami používania
              </Link>{" "}
              a beriem na vedomie{" "}
              <Link href="/ochrana-osobnych-udajov" className="link-underline text-paper" target="_blank">
                spracúvanie osobných údajov
              </Link>
              .
            </>
          }
        />
        <Checkbox id={`${id}-age`} name="age_confirmed" error={state.fieldErrors?.age_confirmed} label="Mám aspoň 18 rokov." />
        <Checkbox
          id={`${id}-emails`}
          name="product_emails"
          label="Chcem dostávať e-maily o nových funkciách. Môžem to kedykoľvek zrušiť."
        />
      </div>
      <SubmitButton pendingLabel="Vytváram účet…" disabled={!available} className="w-full sm:w-auto">
        Vytvoriť účet
      </SubmitButton>
    </form>
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
      <SubmitButton pendingLabel="Posielam…" disabled={!available}>
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
      <SubmitButton pendingLabel="Ukladám…" disabled={!available}>
        Nastaviť heslo
      </SubmitButton>
    </form>
  );
}

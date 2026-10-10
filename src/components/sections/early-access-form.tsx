"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import * as m from "motion/react-m";
import { joinEarlyAccess } from "@/lib/early-access/action";
import {
  EMAIL_MAX_LENGTH,
  HONEYPOT_FIELD,
  MEETING_OPTIONS,
  STAGE_OPTIONS,
  validateEarlyAccess,
  type EarlyAccessField,
  type EarlyAccessResult,
  type FieldErrors,
} from "@/lib/early-access/schema";
import { buttonClasses } from "@/components/ui/button";

const FIELD_ORDER: EarlyAccessField[] = ["email", "stage", "nextMeeting", "consent"];
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

const noopSubscribe = () => () => {};

/** false na serveri a počas hydratácie, true až keď beží JavaScript. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

type Props = {
  available: boolean;
  setupHint: string | null;
};

export function EarlyAccessForm({ available, setupHint }: Props) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState("");
  const [nextMeeting, setNextMeeting] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<EarlyAccessResult | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();

  const startedAt = useRef<number>(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();

    // Klik na „Získať early access“ presunie focus do e-mailu (iba pri myši).
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href$='#early-access']");
      if (!anchor || !window.matchMedia("(pointer: fine)").matches) return;
      window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 50);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (result?.status === "success") successRef.current?.focus();
  }, [result]);

  const values = { email, stage, nextMeeting, consent };

  // Po prvom pokuse o odoslanie validuj priebežne, aby chyby zmizli hneď po oprave.
  const update = (patch: Partial<typeof values>) => {
    if (!attempted) return;
    const next = validateEarlyAccess({ ...values, ...patch });
    setErrors(next.ok ? {} : next.errors);
  };

  const focusField = (field: EarlyAccessField) => {
    const target = document.querySelector<HTMLElement>(`[data-field="${id}-${field}"]`);
    target?.focus();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!available || pending || !hydrated) return;

    setAttempted(true);
    const validation = validateEarlyAccess(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      setResult(null);
      const first = FIELD_ORDER.find((field) => validation.errors[field]);
      if (first) focusField(first);
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("started_at", String(startedAt.current));
    const params = new URLSearchParams(window.location.search);
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) formData.set(key, value);
    }

    setErrors({});
    setResult(null);
    startTransition(async () => {
      try {
        const response = await joinEarlyAccess(formData);
        setResult(response);
        if (response.status === "error" && response.fieldErrors) {
          setErrors(response.fieldErrors);
          const first = FIELD_ORDER.find((field) => response.fieldErrors?.[field]);
          if (first) focusField(first);
        }
      } catch {
        setResult({
          status: "error",
          message:
            "Nepodarilo sa spojiť so serverom. Skontroluj pripojenie, obnov stránku a skús to znova.",
        });
      }
    });
  };

  if (result?.status === "success") {
    return (
      <m.div
        className="rounded-[20px] border border-mint/30 bg-panel p-6 sm:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-mint/15 text-mint">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h3
          ref={successRef}
          tabIndex={-1}
          className="type-heading mt-5 text-[1.75rem] outline-none"
        >
          Si na zozname
        </h3>
        <p className="mt-3 leading-relaxed text-mute">
          Zápis pre <span className="text-paper">{result.email}</span> je uložený.
          Keď budú prvé simulácie pripravené, ozveme sa na tento e-mail.
        </p>
      </m.div>
    );
  }

  const serverError = result?.status === "error" ? result.message : null;
  const errorId = (field: EarlyAccessField) => `${id}-${field}-error`;

  return (
    <form
      method="post"
      noValidate
      onSubmit={onSubmit}
      aria-describedby={serverError ? `${id}-form-error` : undefined}
      className="relative rounded-[20px] border border-line bg-panel p-5 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)] sm:p-8"
    >
      {/* Honeypot: pre ľudí skrytý, boti ho vyplnia. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-${HONEYPOT_FIELD}`}>Nevypĺňaj toto pole</label>
        <input
          id={`${id}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div>
        <label htmlFor={`${id}-email`} className="block text-[15px] font-medium text-paper">
          E-mail
        </label>
        <input
          ref={emailRef}
          id={`${id}-email`}
          data-field={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={EMAIL_MAX_LENGTH}
          placeholder="meno@startup.sk"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            update({ email: event.target.value });
          }}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? errorId("email") : undefined}
          className={`mt-2 block h-12 w-full rounded-[10px] border bg-ink/70 px-4 text-base text-paper placeholder:text-faint transition-[border-color,box-shadow] duration-200 outline-none focus:border-signal-soft focus:shadow-[0_0_0_3px_rgba(147,165,255,0.25)] ${
            errors.email ? "border-coral/80" : "border-line-strong"
          }`}
        />
        <FieldError id={errorId("email")} message={errors.email} />
      </div>

      <ChoiceGroup
        legend="V akej fáze je tvoj startup?"
        name="stage"
        fieldKey={`${id}-stage`}
        options={STAGE_OPTIONS}
        value={stage}
        onChange={(value) => {
          setStage(value);
          update({ stage: value });
        }}
        error={errors.stage}
        errorId={errorId("stage")}
      />

      <ChoiceGroup
        legend="Kedy máš najbližšie stretnutie s investorom?"
        hint="Nepovinné"
        name="nextMeeting"
        fieldKey={`${id}-nextMeeting`}
        options={MEETING_OPTIONS}
        value={nextMeeting}
        onChange={(value) => {
          setNextMeeting(value);
          update({ nextMeeting: value });
        }}
        error={errors.nextMeeting}
        errorId={errorId("nextMeeting")}
      />

      <div className="mt-7">
        <label htmlFor={`${id}-consent`} className="group flex cursor-pointer items-start gap-3">
          <input
            id={`${id}-consent`}
            data-field={`${id}-consent`}
            name="consent"
            type="checkbox"
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              update({ consent: event.target.checked });
            }}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? errorId("consent") : undefined}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 peer-checked:border-signal peer-checked:bg-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-soft ${
              errors.consent ? "border-coral/80" : "border-line-strong group-hover:border-signal-soft/60"
            }`}
          >
            <svg
              viewBox="0 0 16 16"
              className={`size-3.5 text-on-signal transition-opacity ${consent ? "opacity-100" : "opacity-0"}`}
            >
              <path
                d="M3.5 8.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[14px] leading-relaxed text-mute">
            Súhlasím so spracovaním e-mailu a odpovedí z formulára na účely early
            access a informovania o spustení PitchIt. Súhlas môžem kedykoľvek
            odvolať. Viac v{" "}
            <Link href="/ochrana-osobnych-udajov" className="link-underline text-paper">
              zásadách ochrany osobných údajov
            </Link>
            .
          </span>
        </label>
        <FieldError id={errorId("consent")} message={errors.consent} />
      </div>

      {!available ? (
        <div
          role="status"
          className="mt-7 rounded-[12px] border border-marker/40 bg-marker/[0.08] p-4 text-[14px] leading-relaxed text-paper"
        >
          Zápis na early access momentálne nefunguje. Skús to neskôr.
          {setupHint ? <span className="mt-1 block text-mute">{setupHint}</span> : null}
        </div>
      ) : null}

      <div aria-live="assertive" className="empty:hidden">
        {serverError ? (
          <p
            id={`${id}-form-error`}
            className="mt-7 flex gap-2.5 rounded-[12px] border border-coral/40 bg-coral/[0.08] p-4 text-[14px] leading-relaxed text-paper"
          >
            <ErrorIcon />
            {serverError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        // Pred hydratáciou je tlačidlo vypnuté, inak by prehliadač odoslal formulár natívne.
        disabled={!available || pending || !hydrated}
        className={buttonClasses({ size: "lg", className: "mt-7 w-full" })}
      >
        {pending ? (
          <>
            <span
              aria-hidden="true"
              className="spin size-4 rounded-full border-2 border-white/35 border-t-white"
            />
            Ukladám zápis…
          </>
        ) : (
          "Získať early access"
        )}
      </button>
    </form>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-coral">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex gap-2 text-[14px] leading-snug text-coral">
      <ErrorIcon />
      {message}
    </p>
  );
}

function ChoiceGroup({
  legend,
  hint,
  name,
  fieldKey,
  options,
  value,
  onChange,
  error,
  errorId,
}: {
  legend: string;
  hint?: ReactNode;
  name: string;
  fieldKey: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  errorId: string;
}) {
  return (
    <fieldset
      className="mt-7"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="flex w-full items-baseline justify-between gap-3 text-[15px] font-medium text-paper">
        {legend}
        {hint ? <span className="text-[13px] font-normal text-faint">{hint}</span> : null}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option, index) => {
          const checked = value === option.value;
          return (
            <label key={option.value} className="relative">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                data-field={index === 0 ? fieldKey : undefined}
                className="peer sr-only"
              />
              <span
                className={`inline-flex h-11 items-center rounded-[10px] border px-4 text-[15px] transition-[border-color,background-color,color] duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-soft ${
                  checked
                    ? "border-signal-soft bg-signal/15 text-paper"
                    : error
                      ? "border-coral/60 text-mute hover:text-paper"
                      : "border-line-strong text-mute hover:border-signal-soft/50 hover:text-paper"
                }`}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

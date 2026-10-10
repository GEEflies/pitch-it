"use client";

import { useActionState, useEffect, useId, type ReactNode } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES, STAGES, STAGE_LABELS } from "@/lib/domain/labels";
import type { FormState } from "@/lib/projects/actions";

export type ProjectFormValues = {
  name: string;
  one_liner: string;
  industry: string;
  problem: string;
  solution: string;
  target_segment: string;
  business_model: string;
  competition: string;
  differentiation: string;
  traction: string;
  financials: string;
  team: string;
  stage: string;
  raise_amount: string;
  raise_currency: string;
  use_of_funds: string;
  meeting_goal: string;
};

export const emptyProjectValues: ProjectFormValues = {
  name: "",
  one_liner: "",
  industry: "",
  problem: "",
  solution: "",
  target_segment: "",
  business_model: "",
  competition: "",
  differentiation: "",
  traction: "",
  financials: "",
  team: "",
  stage: "pre_seed",
  raise_amount: "",
  raise_currency: "EUR",
  use_of_funds: "",
  meeting_goal: "",
};

function Section({ title, why, children }: { title: string; why: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-6 border-t border-line/70 py-8 md:grid-cols-12 md:gap-10">
      <div className="md:col-span-4">
        <legend className="type-heading text-[1.25rem]">{title}</legend>
        <p className="mt-2 text-[14.5px] leading-relaxed text-faint">{why}</p>
      </div>
      <div className="space-y-5 md:col-span-8">{children}</div>
    </fieldset>
  );
}

export function ProjectForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: ProjectFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" } as FormState);
  const toast = useToast();
  const id = useId();
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success" && state.message) toast.show(state.message);
  }, [state, toast]);

  const text = (name: keyof ProjectFormValues, label: string, options: { hint?: string; rows?: number; optional?: boolean; placeholder?: string } = {}) => (
    <Field id={`${id}-${name}`} label={label} hint={options.hint} error={errors[name]} optional={options.optional}>
      <Textarea
        id={`${id}-${name}`}
        name={name}
        rows={options.rows ?? 3}
        defaultValue={initial[name]}
        placeholder={options.placeholder}
        hint={options.hint}
        error={errors[name]}
        maxLength={4000}
      />
    </Field>
  );

  return (
    <form action={formAction} noValidate>
      {state.status === "error" && state.message ? (
        <Notice tone="error" className="mb-6">
          {state.message}
        </Notice>
      ) : null}

      <Section title="Základ" why="Investor si z toho poskladá prvý dojem: čo robíte, pre koho a v akej ste fáze.">
        <Field id={`${id}-name`} label="Názov startupu" error={errors.name}>
          <Input id={`${id}-name`} name="name" required maxLength={120} defaultValue={initial.name} error={errors.name} />
        </Field>
        <Field
          id={`${id}-one_liner`}
          label="Jednou vetou"
          hint="Čo robíte a pre koho. Napríklad: Účtovníctvo pre e-shopy, ktoré sa samo napojí na sklad."
          error={errors.one_liner}
          optional
        >
          <Input
            id={`${id}-one_liner`}
            name="one_liner"
            maxLength={400}
            defaultValue={initial.one_liner}
            hint="hint"
            error={errors.one_liner}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${id}-industry`} label="Odvetvie" optional error={errors.industry}>
            <Input id={`${id}-industry`} name="industry" maxLength={120} defaultValue={initial.industry} error={errors.industry} />
          </Field>
          <Field id={`${id}-stage`} label="Fáza" error={errors.stage}>
            <Select id={`${id}-stage`} name="stage" defaultValue={initial.stage} error={errors.stage}>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Problém a riešenie" why="Prvé otázky bývajú: koho to bolí, ako to rieši dnes a prečo prejde k vám.">
        {text("problem", "Problém", { optional: true, hint: "Koho konkrétne to bolí a koľko ho to stojí." })}
        {text("solution", "Riešenie", { optional: true })}
        {text("target_segment", "Cieľový segment a trh", {
          optional: true,
          hint: "Ideálne s výpočtom zdola: počet zákazníkov × cena.",
        })}
      </Section>

      <Section title="Biznis a konkurencia" why="Investor overuje, kto platí, koľko a čo vás odlíši, keď prídu silnejší hráči.">
        {text("business_model", "Biznis model", { optional: true, hint: "Kto platí, koľko a ako často." })}
        {text("competition", "Konkurencia", { optional: true, hint: "Vrátane toho, čo zákazník robí dnes bez vás." })}
        {text("differentiation", "Diferenciácia", { optional: true })}
      </Section>

      <Section title="Trakcia a čísla" why="Čísla sa porovnávajú s tým, čo poviete nahlas. Rozpory investor zachytí.">
        {text("traction", "Trakcia", {
          optional: true,
          hint: "Platiaci zákazníci, rast, retencia. Uveď obdobie.",
        })}
        {text("financials", "Finančné ukazovatele", {
          optional: true,
          hint: "Tržby, marža, burn, runway, CAC, LTV. Uveď, čo je skutočnosť a čo plán.",
        })}
      </Section>

      <Section title="Tím" why="Pri skorých fázach je tím často hlavný dôvod investície.">
        {text("team", "Tím", { optional: true, hint: "Kto ste, čo ste robili predtým a prečo práve vy." })}
      </Section>

      <Section title="Investícia a stretnutie" why="Jasná požiadavka a cieľ stretnutia určujú, kam investor rozhovor nasmeruje.">
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field id={`${id}-raise_amount`} label="Koľko získavate" optional error={errors.raise_amount}>
            <Input
              id={`${id}-raise_amount`}
              name="raise_amount"
              inputMode="decimal"
              defaultValue={initial.raise_amount}
              error={errors.raise_amount}
            />
          </Field>
          <Field id={`${id}-raise_currency`} label="Mena" error={errors.raise_currency}>
            <Select id={`${id}-raise_currency`} name="raise_currency" defaultValue={initial.raise_currency}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {text("use_of_funds", "Použitie investície", { optional: true, hint: "Na čo pôjdu peniaze a aké míľniky odomknú." })}
        <Field
          id={`${id}-meeting_goal`}
          label="Na aké stretnutie sa pripravuješ"
          optional
          hint="Napríklad: prvé stretnutie s pre-seed fondom budúci týždeň."
          error={errors.meeting_goal}
        >
          <Input
            id={`${id}-meeting_goal`}
            name="meeting_goal"
            maxLength={1000}
            defaultValue={initial.meeting_goal}
            hint="hint"
            error={errors.meeting_goal}
          />
        </Field>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line/70 bg-ink/95 px-4 py-4 sm:mx-0 sm:px-0">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

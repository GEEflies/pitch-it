"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import {
  FACT_CATEGORIES,
  FACT_CATEGORY_LABELS,
  FACT_SOURCE_LABELS,
  ISSUE_KIND_LABELS,
  type FactCategory,
  type FactSource,
  type FactStatus,
  type IssueKind,
} from "@/lib/domain/labels";
import { addFactAction, deleteFactAction, reviewFactAction, setIssueStatusAction, type FormState } from "@/lib/projects/actions";

export type FactItem = {
  id: string;
  category: FactCategory;
  label: string;
  valueText: string;
  period: string | null;
  sourceType: FactSource;
  status: FactStatus;
  confidence: "low" | "medium" | "high" | null;
  slideNumber: number | null;
  quote: string | null;
};

export type IssueItem = {
  id: string;
  kind: IssueKind;
  description: string;
  slideNumber: number | null;
  status: "open" | "resolved" | "dismissed";
};

const SOURCE_STYLE: Record<FactSource, string> = {
  user: "border-mint/40 text-mint",
  document: "border-signal-soft/45 text-signal-soft",
  ai_inference: "border-marker/45 text-marker",
};

function SourceBadge({ source, status }: { source: FactSource; status: FactStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] whitespace-nowrap ${SOURCE_STYLE[source]}`}>
      {FACT_SOURCE_LABELS[source]}
      {status === "needs_review" ? ", na kontrolu" : ""}
    </span>
  );
}

function FactRow({ fact, projectId, canEdit }: { fact: FactItem; projectId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fact.valueText);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.show(result.message ?? "Akcia zlyhala.", "error");
      else if (result.message) toast.show(result.message);
      setEditing(false);
    });

  const review = (decision: "confirm" | "reject", corrected: string | null = null) => {
    const formData = new FormData();
    formData.set("factId", fact.id);
    formData.set("decision", decision);
    if (corrected) formData.set("corrected_value", corrected);
    run(() => reviewFactAction(projectId, formData));
  };

  return (
    <li className={`py-4 ${fact.status === "rejected" ? "opacity-55" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[14.5px] text-mute">{fact.label}</p>
          {editing ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Opravená hodnota: ${fact.label}`} maxLength={2000} />
              <button
                type="button"
                className={buttonClasses({ className: "shrink-0" })}
                disabled={pending || !value.trim()}
                onClick={() => review("confirm", value.trim())}
              >
                Uložiť opravu
              </button>
            </div>
          ) : (
            <p className="mt-0.5 text-paper">
              {fact.valueText}
              {fact.period ? <span className="text-faint"> ({fact.period})</span> : null}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-faint">
            <SourceBadge source={fact.sourceType} status={fact.status} />
            {fact.slideNumber ? <span>slide {fact.slideNumber}</span> : null}
            {fact.status === "rejected" ? <span>zamietnuté, investor ho nepoužije</span> : null}
          </div>
          {fact.quote && fact.status === "needs_review" ? (
            <p className="type-investor mt-2 border-l-2 border-line-strong pl-3 text-[14.5px] text-paper/75">„{fact.quote}“</p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap gap-1">
            {fact.status === "needs_review" ? (
              <>
                <button type="button" className={buttonClasses({ variant: "secondary", className: "h-9 px-3 text-sm" })} disabled={pending} onClick={() => review("confirm")}>
                  Potvrdiť
                </button>
                <button type="button" className={buttonClasses({ variant: "ghost", className: "h-9 px-3 text-sm" })} disabled={pending} onClick={() => setEditing((current) => !current)}>
                  {editing ? "Zrušiť" : "Opraviť"}
                </button>
                <button type="button" className={buttonClasses({ variant: "ghost", className: "h-9 px-3 text-sm" })} disabled={pending} onClick={() => review("reject")}>
                  Zamietnuť
                </button>
              </>
            ) : (
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", className: "h-9 px-3 text-sm" })}
                disabled={pending}
                onClick={() => run(() => deleteFactAction(projectId, fact.id))}
              >
                Zmazať
              </button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function FactList({ facts, projectId, canEdit }: { facts: FactItem[]; projectId: string; canEdit: boolean }) {
  const [filter, setFilter] = useState<"all" | "needs_review">(facts.some((fact) => fact.status === "needs_review") ? "needs_review" : "all");
  const visible = facts.filter((fact) => (filter === "all" ? true : fact.status === "needs_review"));
  const grouped = FACT_CATEGORIES.map((category) => ({
    category,
    items: visible.filter((fact) => fact.category === category),
  })).filter((group) => group.items.length > 0);
  const reviewCount = facts.filter((fact) => fact.status === "needs_review").length;

  return (
    <div>
      <div role="tablist" aria-label="Filter faktov" className="flex gap-2">
        {(
          [
            ["needs_review", `Na kontrolu (${reviewCount})`],
            ["all", `Všetky (${facts.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              filter === key ? "border-signal-soft/60 bg-signal/10 text-paper" : "border-line-strong text-mute hover:text-paper"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {grouped.length === 0 ? (
        <p className="mt-6 text-mute">
          {filter === "needs_review" ? "Všetko je skontrolované." : "Zatiaľ žiadne fakty. Nahraj podklad alebo pridaj údaj ručne."}
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map((group) => (
            <section key={group.category} aria-label={FACT_CATEGORY_LABELS[group.category]}>
              <h3 className="text-[15px] font-semibold text-paper">{FACT_CATEGORY_LABELS[group.category]}</h3>
              <ul className="mt-1 divide-y divide-line/60">
                {group.items.map((fact) => (
                  <FactRow key={fact.id} fact={fact} projectId={projectId} canEdit={canEdit} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddFactForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(addFactAction.bind(null, projectId), { status: "idle" } as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const id = useId();

  useEffect(() => {
    if (state.status === "success") {
      toast.show(state.message ?? "Uložené.");
      formRef.current?.reset();
    }
  }, [state, toast]);

  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-category`} label="Kategória" error={errors.category}>
          <Select id={`${id}-category`} name="category" defaultValue="traction">
            {FACT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {FACT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-period`} label="Obdobie" optional error={errors.period}>
          <Input id={`${id}-period`} name="period" maxLength={60} placeholder="napr. september 2026" error={errors.period} />
        </Field>
      </div>
      <Field id={`${id}-label`} label="Údaj" error={errors.label}>
        <Input id={`${id}-label`} name="label" maxLength={160} placeholder="napr. Platiaci zákazníci" error={errors.label} />
      </Field>
      <Field id={`${id}-value`} label="Hodnota" error={errors.value_text}>
        <Textarea id={`${id}-value`} name="value_text" rows={2} maxLength={2000} placeholder="napr. 48 firiem, mesačne +12 %" error={errors.value_text} />
      </Field>
      <SubmitButton pendingLabel="Pridávam…" variant="secondary">
        Pridať údaj
      </SubmitButton>
    </form>
  );
}

export function IssueList({ issues, projectId, canEdit }: { issues: IssueItem[]; projectId: string; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const open = issues.filter((issue) => issue.status === "open");
  const closed = issues.filter((issue) => issue.status !== "open");

  const setStatus = (issueId: string, status: "resolved" | "dismissed" | "open") => {
    const formData = new FormData();
    formData.set("issueId", issueId);
    formData.set("status", status);
    startTransition(async () => {
      const result = await setIssueStatusAction(projectId, formData);
      if (result.status === "error") toast.show(result.message ?? "Akcia zlyhala.", "error");
    });
  };

  if (issues.length === 0) {
    return <p className="text-mute">Zatiaľ žiadne. Po analýze podkladu tu uvidíš, čo chýba alebo si protirečí.</p>;
  }

  return (
    <div>
      <ul className="space-y-3">
        {open.map((issue) => (
          <li key={issue.id} className="rounded-[12px] border border-marker/30 bg-marker/[0.05] p-4">
            <p className="text-sm font-semibold text-marker">
              {ISSUE_KIND_LABELS[issue.kind]}
              {issue.slideNumber ? <span className="font-normal text-faint">, slide {issue.slideNumber}</span> : null}
            </p>
            <p className="mt-1 leading-relaxed text-paper/90">{issue.description}</p>
            {canEdit ? (
              <div className="mt-3 flex gap-1">
                <button type="button" disabled={pending} onClick={() => setStatus(issue.id, "resolved")} className={buttonClasses({ variant: "secondary", className: "h-9 px-3 text-sm" })}>
                  Vyriešené
                </button>
                <button type="button" disabled={pending} onClick={() => setStatus(issue.id, "dismissed")} className={buttonClasses({ variant: "ghost", className: "h-9 px-3 text-sm" })}>
                  Nie je problém
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {closed.length > 0 ? (
        <details className="mt-4">
          <summary className="text-sm text-mute">Uzavreté ({closed.length})</summary>
          <ul className="mt-3 space-y-2">
            {closed.map((issue) => (
              <li key={issue.id} className="flex items-start justify-between gap-3 text-[14.5px] text-faint">
                <span>
                  {ISSUE_KIND_LABELS[issue.kind]}: {issue.description}
                </span>
                {canEdit ? (
                  <button type="button" disabled={pending} onClick={() => setStatus(issue.id, "open")} className="shrink-0 text-sm text-mute hover:text-paper">
                    Otvoriť
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

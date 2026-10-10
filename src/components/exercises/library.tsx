"use client";

import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { startLibraryExerciseAction } from "@/lib/exercises/actions";
import type { ExerciseTemplate } from "@/lib/exercises/catalog";

const KIND_LABEL: Record<ExerciseTemplate["kind"], string> = {
  answer_drill: "Jedna otázka",
  mini_simulation: "Krátka simulácia",
  pitch_timed: "Prednes na čas",
};

export function ExerciseLibrary({
  templates,
  projects,
}: {
  templates: ExerciseTemplate[];
  projects: Array<{ id: string; name: string }>;
}) {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const start = (key: string) => {
    setPendingKey(key);
    startTransition(async () => {
      const result = await startLibraryExerciseAction(key, projectId || null);
      if (result?.status === "error") toast.show(result.message ?? "Cvičenie sa nepodarilo spustiť.", "error");
      setPendingKey(null);
    });
  };

  return (
    <div>
      {projects.length > 1 ? (
        <div className="mb-8 max-w-[22rem]">
          <label htmlFor="exercise-project" className="text-sm font-medium text-paper">
            Otázky prispôsobiť projektu
          </label>
          <div className="mt-1.5">
            <Select id="exercise-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}
      <div className="space-y-10">
        {EXERCISE_CATEGORIES.map((category) => {
          const items = templates.filter((template) => template.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} aria-label={EXERCISE_CATEGORY_LABELS[category]}>
              <h3 className="text-[15px] font-semibold text-paper">{EXERCISE_CATEGORY_LABELS[category]}</h3>
              <ul className="mt-3 divide-y divide-line/60 border-y border-line/60">
                {items.map((template) => (
                  <li key={template.key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-paper">{template.title}</p>
                      <p className="mt-0.5 text-[14px] leading-relaxed text-mute">{template.rationale}</p>
                      <p className="mt-1 text-[13px] text-faint">
                        {KIND_LABEL[template.kind]}, {Math.round(template.timeLimitSeconds / 60) || 1} min
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => start(template.key)}
                      disabled={pendingKey !== null}
                      className={buttonClasses({ variant: "secondary", className: "shrink-0" })}
                    >
                      {pendingKey === template.key ? <Spinner /> : null}
                      Začať
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

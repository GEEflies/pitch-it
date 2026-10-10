import type { Metadata } from "next";
import Link from "next/link";
import { ExerciseLibrary } from "@/components/exercises/library";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { listExercises } from "@/lib/db/exercises";
import { listProjects } from "@/lib/db/projects";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { EXERCISE_LIBRARY } from "@/lib/exercises/catalog";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Cvičenia" };

export default async function ExercisesPage() {
  const user = await requireUser("/app/cvicenia");
  const [exercises, projects] = await Promise.all([listExercises(user.id), listProjects()]);
  const open = exercises.filter((exercise) => exercise.status === "open");
  const done = exercises.filter((exercise) => exercise.status === "completed");

  return (
    <>
      <PageHeader
        title="Cvičenia"
        description="Krátke opakovania tam, kde odpovede neobstáli. Cvičenia z rozboru vychádzajú z tvojich skutočných slabín, knižnica pokrýva otázky, ktoré prídu takmer vždy."
      />

      <section aria-labelledby="mine" className="mb-14">
        <h2 id="mine" className="type-heading text-[1.4rem]">
          Na precvičenie
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 max-w-[40rem] leading-relaxed text-mute">
            Zatiaľ nič otvorené. Po tréningu tu pribudnú cvičenia z rozboru. Môžeš začať aj z knižnice nižšie.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {open.map((exercise) => (
              <li key={exercise.id}>
                <Link
                  href={`/app/cvicenia/${exercise.id}`}
                  className="block h-full rounded-[14px] border border-line bg-panel/60 p-5 transition-colors hover:border-signal-soft/60"
                >
                  <p className="flex items-center gap-2 text-[13px] text-faint">
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${exercise.origin === "report" ? "bg-marker" : "bg-line-strong"}`} />
                    {exercise.origin === "report" ? "Z rozboru tréningu" : "Z knižnice"}, {EXERCISE_CATEGORY_LABELS[exercise.category].toLowerCase()}
                  </p>
                  <p className="mt-2 font-medium text-paper">{exercise.title}</p>
                  <p className="type-investor mt-2 line-clamp-2 text-[15px] leading-relaxed text-paper/75">{exercise.prompt}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 ? (
          <details className="mt-6">
            <summary className="text-sm text-mute">Hotové ({done.length})</summary>
            <ul className="mt-3 space-y-1.5">
              {done.map((exercise) => (
                <li key={exercise.id}>
                  <Link href={`/app/cvicenia/${exercise.id}`} className="text-[14.5px] text-paper/85 hover:text-paper">
                    {exercise.title}
                  </Link>
                  <span className="ml-2 text-[13px] text-faint">{exercise.completed_at ? formatDate(exercise.completed_at) : ""}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="library">
        <h2 id="library" className="type-heading text-[1.4rem]">
          Knižnica
        </h2>
        <p className="mb-6 mt-2 max-w-[40rem] leading-relaxed text-mute">
          Jedna otázka trvá minútu až dve. Krátka simulácia a prednes na čas spustia tréning s vybraným scenárom.
        </p>
        <ExerciseLibrary templates={EXERCISE_LIBRARY} projects={projects.map((project) => ({ id: project.id, name: project.name }))} />
      </section>
    </>
  );
}

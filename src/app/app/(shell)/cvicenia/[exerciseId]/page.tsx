import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttemptRecorder } from "@/components/exercises/attempt-recorder";
import { FounderQuote } from "@/components/report/parts";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getExercise, listAttempts } from "@/lib/db/exercises";
import { toNumber } from "@/lib/db/types";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { deleteExerciseAction, setExerciseStatusAction } from "@/lib/exercises/actions";
import { attemptEvaluationSchema } from "@/lib/exercises/evaluation";
import { formatDateTime, formatDuration } from "@/lib/format";
import { CATEGORY_INVESTOR } from "@/lib/exercises/catalog";
import { isUuid } from "@/lib/validation/ids";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Cvičenie" };

const MET: Record<"yes" | "partly" | "no", { label: string; className: string }> = {
  yes: { label: "Splnené", className: "text-mint" },
  partly: { label: "Čiastočne", className: "text-paper/85" },
  no: { label: "Chýba", className: "text-marker" },
};

export default async function ExercisePage({ params }: PageProps<"/app/cvicenia/[exerciseId]">) {
  const { exerciseId } = await params;
  await requireUser(`/app/cvicenia/${exerciseId}`);
  if (!isUuid(exerciseId)) notFound();
  const exercise = await getExercise(exerciseId);
  if (!exercise) notFound();
  const attempts = await listAttempts(exercise.id);

  const simulationParams = new URLSearchParams({
    rezim: exercise.kind === "pitch_timed" ? "delivery" : "coach",
    investor: CATEGORY_INVESTOR[exercise.category],
    cvicenie: exercise.id,
  });
  if (exercise.project_id) simulationParams.set("projekt", exercise.project_id);

  return (
    <>
      <PageHeader
        back={
          <Link href="/app/cvicenia" className="link-underline text-sm text-mute hover:text-paper">
            Cvičenia
          </Link>
        }
        title={exercise.title}
        description={`${EXERCISE_CATEGORY_LABELS[exercise.category]}${exercise.origin === "report" ? ", vzniklo z rozboru tvojho tréningu" : ""}.`}
        actions={
          exercise.status === "completed" ? (
            <ConfirmAction
              trigger="Otvoriť znova"
              tone="default"
              triggerClassName={buttonClasses({ variant: "secondary" })}
              title="Otvoriť cvičenie znova?"
              description="Cvičenie sa vráti medzi otvorené."
              confirmLabel="Otvoriť"
              pendingLabel="Ukladám…"
              action={setExerciseStatusAction.bind(null, exercise.id, "open")}
            />
          ) : (
            <ConfirmAction
              trigger="Označiť ako hotové"
              tone="default"
              triggerClassName={buttonClasses({ variant: "secondary" })}
              title="Označiť cvičenie ako hotové?"
              description="Presunie sa medzi hotové. Pokusy ostanú uložené."
              confirmLabel="Hotové"
              pendingLabel="Ukladám…"
              action={setExerciseStatusAction.bind(null, exercise.id, "completed")}
            />
          )
        }
      />

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-8 lg:col-span-7">
          <figure className="border-l-2 border-signal/70 pl-6">
            <figcaption className="text-[13px] text-faint">Investor sa pýta</figcaption>
            <blockquote className="type-investor mt-2 text-[clamp(1.4rem,1.1rem+1vw,2rem)] leading-[1.3] text-paper">
              {exercise.prompt}
            </blockquote>
          </figure>

          {exercise.kind === "answer_drill" ? (
            <AttemptRecorder exerciseId={exercise.id} timeLimitSeconds={exercise.time_limit_seconds} />
          ) : (
            <Notice
              tone="info"
              title="Toto cvičenie je krátky tréning"
              action={
                <Link href={`/app/trening/novy?${simulationParams.toString()}`} className={buttonClasses()}>
                  Pripraviť tréning
                </Link>
              }
            >
              Spustí sa tréning so zodpovedajúcim scenárom. Po jeho dokončení sa cvičenie uzavrie.
            </Notice>
          )}

          {attempts.length > 0 ? (
            <section aria-labelledby="attempts">
              <h2 id="attempts" className="type-heading text-[1.4rem]">
                Pokusy
              </h2>
              <ol className="mt-4 space-y-8">
                {attempts.map((attempt, index) => {
                  const evaluation = attempt.evaluation ? attemptEvaluationSchema.safeParse(attempt.evaluation) : null;
                  const wpm = toNumber(attempt.words_per_minute);
                  return (
                    <li key={attempt.id} className="border-t border-line/70 pt-6">
                      <p className="text-[13px] text-faint">
                        Pokus {attempts.length - index}, {formatDateTime(attempt.created_at)}, {attempt.input_method === "voice" ? "hlasom" : "textom"}
                      </p>
                      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
                        <div>
                          <dt className="text-faint">Dĺžka</dt>
                          <dd className="tabular-nums text-paper">
                            {attempt.duration_ms ? formatDuration(attempt.duration_ms / 1000) : `${attempt.word_count ?? 0} slov`}
                          </dd>
                        </div>
                        {wpm !== null ? (
                          <div>
                            <dt className="text-faint">Tempo</dt>
                            <dd className="tabular-nums text-paper">{Math.round(wpm)} slov/min</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="text-faint">Výplňové slová</dt>
                          <dd className="tabular-nums text-paper">{attempt.filler_count ?? 0}</dd>
                        </div>
                      </dl>
                      <div className="mt-4">
                        <FounderQuote text={attempt.answer_text.length > 600 ? `${attempt.answer_text.slice(0, 600)}…` : attempt.answer_text} />
                      </div>
                      {evaluation?.success ? (
                        <div className="mt-5 space-y-4">
                          <ul className="space-y-2">
                            {evaluation.data.criteria.map((criterion) => (
                              <li key={criterion.criterion} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                                <span className={`text-[14px] font-medium ${MET[criterion.met].className}`}>{MET[criterion.met].label}</span>
                                <span className="text-[14.5px] leading-relaxed text-paper/90">
                                  {criterion.criterion}
                                  <span className="block text-mute">{criterion.note}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="leading-relaxed text-paper/90">{evaluation.data.summary}</p>
                          <div className="rounded-[12px] border border-line bg-panel/60 p-4">
                            <p className="text-[13px] text-faint">Ukážka (iba z tvojich údajov)</p>
                            <p className="mt-1.5 leading-relaxed text-paper/90">{evaluation.data.improved_example}</p>
                          </div>
                          <p className="text-[14.5px] text-mute">Pri ďalšom pokuse: {evaluation.data.next_step}</p>
                        </div>
                      ) : attempt.evaluation_status === "not_configured" ? (
                        <p className="mt-4 text-[14px] text-faint">AI vyhodnotenie nie je dostupné, uložili sme iba odpoveď a merania.</p>
                      ) : attempt.evaluation_status === "failed" ? (
                        <p className="mt-4 text-[14px] text-marker">Vyhodnotenie sa nepodarilo. Skús ďalší pokus.</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="space-y-8 lg:col-span-5">
          {exercise.success_criteria.length > 0 ? (
            <section aria-labelledby="criteria" className="rounded-[16px] border border-line p-5">
              <h2 id="criteria" className="text-[15px] font-semibold text-paper">
                Dobrá odpoveď
              </h2>
              <ul className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-paper/90">
                {exercise.success_criteria.map((criterion) => (
                  <li key={criterion} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-signal-soft" />
                    {criterion}
                  </li>
                ))}
              </ul>
              {exercise.time_limit_seconds ? (
                <p className="mt-3 text-[13px] text-faint">Cieľová dĺžka do {formatDuration(exercise.time_limit_seconds)}.</p>
              ) : null}
            </section>
          ) : null}
          {exercise.rationale ? (
            <section aria-labelledby="why">
              <h2 id="why" className="text-[15px] font-semibold text-paper">
                Prečo práve toto
              </h2>
              <p className="mt-2 leading-relaxed text-mute">{exercise.rationale}</p>
            </section>
          ) : null}
          {exercise.original_excerpt ? (
            <section aria-labelledby="original">
              <h2 id="original" className="text-[15px] font-semibold text-paper">
                Tvoja pôvodná odpoveď
              </h2>
              <div className="mt-2">
                <FounderQuote text={exercise.original_excerpt} />
              </div>
              {exercise.source_session_id ? (
                <Link href={`/app/trening/${exercise.source_session_id}`} className="link-underline mt-2 inline-block text-sm text-mute hover:text-paper">
                  Rozbor tréningu
                </Link>
              ) : null}
            </section>
          ) : null}
          <ConfirmAction
            trigger="Zmazať cvičenie"
            title="Zmazať cvičenie?"
            description="Zmaže sa aj história pokusov."
            confirmLabel="Zmazať"
            pendingLabel="Mažem…"
            action={deleteExerciseAction.bind(null, exercise.id)}
          />
        </aside>
      </div>
    </>
  );
}

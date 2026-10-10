import Link from "next/link";
import { ColumnChart } from "@/components/charts/column-chart";
import { FounderQuote, ProvenanceTag, RatingChip, ReportSection, Stat } from "@/components/report/parts";
import { ReportStatusPoller, RetryReportButton } from "@/components/report/report-status";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import type { ReportRow, SessionRow, TurnRow } from "@/lib/db/types";
import { EXERCISE_CATEGORY_LABELS, TRAINING_MODE_LABELS } from "@/lib/domain/labels";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { INVESTOR_STYLES, SCENARIOS, isInvestorKey, isScenarioKey } from "@/lib/investor/catalog";
import {
  CONTENT_DIMENSIONS,
  CONTENT_DIMENSION_LABELS,
  PITCH_ELEMENT_LABELS,
  assessmentSchema,
} from "@/lib/reports/assessment";
import { deliveryObservations } from "@/lib/reports/delivery-feedback";
import type { SessionMeasurements } from "@/lib/reports/measured";
import { deleteSessionAction } from "@/lib/session/actions";


const VERDICT: Record<string, { label: string; className: string }> = {
  answered: { label: "Zodpovedané", className: "text-mint" },
  partially_answered: { label: "Čiastočne", className: "text-paper/85" },
  evaded: { label: "Vyhnutie sa otázke", className: "text-marker" },
  not_answered: { label: "Bez odpovede", className: "text-coral" },
};

const COVERAGE: Record<string, { label: string; className: string }> = {
  clear: { label: "Jasne", className: "text-mint" },
  brief: { label: "Iba letmo", className: "text-paper/85" },
  missing: { label: "Chýba", className: "text-marker" },
};

const FRAMING_LABELS: Record<string, string> = {
  face_often_missing: "tvár často mimo záberu",
  off_center: "tvár mimo stredu záberu",
  too_far: "príliš ďaleko od kamery",
  too_close: "príliš blízko pri kamere",
};

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : `${Math.round(value * 100)} %`;
}

function seconds(ms: number | null): string {
  return ms === null ? "–" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

export type ReportViewData = {
  session: Pick<SessionRow, "id" | "mode" | "status" | "project_id" | "investor_key" | "scenario_key" | "created_at" | "camera_enabled">;
  projectName: string | null;
  report: Pick<ReportRow, "status" | "error_code" | "measured" | "assessment"> | null;
  turns: Array<Pick<TurnRow, "seq" | "speaker" | "text" | "interrupted">>;
  sessionExercises: Array<{ id: string; title: string }>;
  links: { history: string; retest: string; materials: string; exercises: string; exercise: (id: string) => string };
  /** Vývojová ukážka: bez akcií, ktoré volajú server. */
  preview?: boolean;
};

/** Report po tréningu. Dáta dodá stránka (alebo ukážka), komponent iba zobrazuje. */
export function ReportView({ session, projectName, report, turns, sessionExercises, links, preview = false }: ReportViewData) {
  const project = projectName ? { name: projectName } : null;
  const style = isInvestorKey(session.investor_key) ? INVESTOR_STYLES[session.investor_key] : null;
  const scenario = isScenarioKey(session.scenario_key) ? SCENARIOS[session.scenario_key] : null;
  const measured = report && Object.keys(report.measured ?? {}).length > 0 ? (report.measured as unknown as SessionMeasurements) : null;
  const parsedAssessment = report?.assessment ? assessmentSchema.safeParse(report.assessment) : null;
  const assessment = parsedAssessment?.success ? parsedAssessment.data : null;
  const turnBySeq = new Map(turns.map((turn) => [turn.seq, turn]));
  const observations = measured ? deliveryObservations(measured) : [];
  const delivery = session.mode === "delivery";
  const pending = !report || report.status === "pending" || report.status === "generating";

  return (
    <>
      <PageHeader
        back={
          <Link href={links.history} className="link-underline text-sm text-mute hover:text-paper">
            História
          </Link>
        }
        title="Rozbor tréningu"
        description={
          <>
            {project?.name ?? "Projekt"}: {delivery ? scenario?.name : `${style?.name ?? "investor"}, ${scenario?.name.toLowerCase() ?? ""}`}.{" "}
            {TRAINING_MODE_LABELS[session.mode]}, {formatDateTime(session.created_at)}, {formatDuration(measured?.durationSeconds ?? null)}.
          </>
        }
        actions={
          <Link href={links.retest} className={buttonClasses()}>
            Nový pokus
          </Link>
        }
      />

      {session.status === "abandoned" ? (
        <Notice tone="attention" className="mb-6">
          Tréning sa prerušil bez riadneho ukončenia (zatvorené okno alebo výpadok). Rozbor vychádza z toho, čo sa stihlo uložiť.
        </Notice>
      ) : null}

      {pending && !preview ? <ReportStatusPoller sessionId={session.id} /> : null}
      {report?.status === "failed" ? (
        <Notice
          tone="error"
          title="Rozbor obsahu sa nepodarilo pripraviť"
          action={report.error_code === "limit_reached" ? undefined : preview ? undefined : <RetryReportButton sessionId={session.id} />}
        >
          {report.error_code === "limit_reached"
            ? "Limit reportov je na tento mesiac vyčerpaný. Merania nižšie sú dostupné."
            : "Merania nižšie sú uložené. Rozbor obsahu môžeš skúsiť pripraviť znova."}
        </Notice>
      ) : null}
      {report?.status === "not_configured" ? (
        <Notice tone="attention" title="AI hodnotenie nie je dostupné" action={preview ? undefined : <RetryReportButton sessionId={session.id} />}>
          Zobrazujeme iba objektívne merania. AI rozbor obsahu sa pripraví, keď bude služba dostupná.
        </Notice>
      ) : null}
      {report?.status === "insufficient_data" ? (
        <Notice tone="attention" title="Na rozbor je málo dát">
          V rozhovore zaznelo príliš málo tvojich odpovedí. Skús dlhší tréning.
        </Notice>
      ) : null}

      {assessment ? (
        <>
          <ReportSection id="summary" title="Zhrnutie" provenance="ai">
            <p className="max-w-[46rem] text-[1.1rem] leading-relaxed text-paper">{assessment.summary}</p>
            {assessment.strengths.length > 0 ? (
              <div className="mt-8">
                <h3 className="text-[15px] font-semibold text-paper">Čo fungovalo</h3>
                <ul className="mt-3 space-y-2">
                  {assessment.strengths.map((strength) => (
                    <li key={`${strength.turn_seq}-${strength.point}`} className="flex gap-3 leading-relaxed text-paper/90">
                      <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-mint" />
                      <span>
                        {strength.point}{" "}
                        <a href={`#tah-${strength.turn_seq}`} className="text-[12.5px] text-faint hover:text-paper">
                          odpoveď {strength.turn_seq}
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ReportSection>

          <ReportSection
            id="content"
            title="Obsah a argumentácia"
            provenance="ai"
            intro="Každé hodnotenie má vysvetlenie a citáciu z prepisu. Citácie, ktoré sa v prepise nenašli, sme vyradili."
          >
            <dl className="divide-y divide-line/60">
              {CONTENT_DIMENSIONS.map((key) => {
                const dimension = assessment.content_dimensions.find((item) => item.key === key);
                if (!dimension) return null;
                return (
                  <div key={key} className="grid gap-3 py-5 md:grid-cols-12 md:gap-6">
                    <dt className="md:col-span-4">
                      <p className="font-medium text-paper">{CONTENT_DIMENSION_LABELS[key]}</p>
                      <div className="mt-2">
                        <RatingChip rating={dimension.rating} />
                      </div>
                    </dt>
                    <dd className="space-y-3 md:col-span-8">
                      <p className="leading-relaxed text-paper/90">{dimension.explanation}</p>
                      {dimension.evidence.map((item) => (
                        <FounderQuote key={`${item.turn_seq}-${item.quote}`} text={item.quote} seq={item.turn_seq} />
                      ))}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </ReportSection>

          {!delivery && assessment.questions.length > 0 ? (
            <ReportSection id="questions" title="Otázky investora" provenance="ai">
              <ol className="space-y-4">
                {assessment.questions.map((question) => {
                  const turn = turnBySeq.get(question.investor_turn_seq);
                  const verdict = VERDICT[question.verdict];
                  return (
                    <li key={question.investor_turn_seq} className="grid gap-2 md:grid-cols-12 md:gap-6">
                      <div className="md:col-span-7">
                        <p className="text-[13px] text-faint">{question.topic}</p>
                        <p className="type-investor mt-1 text-[1.05rem] leading-relaxed text-paper">{turn?.text ?? ""}</p>
                      </div>
                      <div className="md:col-span-5">
                        <p className={`text-[14px] font-medium ${verdict.className}`}>{verdict.label}</p>
                        <p className="mt-1 text-[14.5px] leading-relaxed text-mute">{question.note}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ReportSection>
          ) : null}

          {assessment.consistency_issues.length > 0 || assessment.unsupported_claims.length > 0 || assessment.data_gaps.length > 0 ? (
            <ReportSection id="claims" title="Rozpory a nepodložené tvrdenia" provenance="ai">
              <div className="grid gap-10 lg:grid-cols-2">
                {assessment.consistency_issues.length > 0 ? (
                  <div>
                    <h3 className="text-[15px] font-semibold text-paper">Nesedí s podkladmi</h3>
                    <ul className="mt-3 space-y-4">
                      {assessment.consistency_issues.map((issue) => (
                        <li key={`${issue.turn_seq}-${issue.claim}`}>
                          <FounderQuote text={issue.claim} seq={issue.turn_seq} />
                          <p className="mt-1 text-[14.5px] leading-relaxed text-mute">V rozpore s: {issue.conflicts_with}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {assessment.unsupported_claims.length > 0 ? (
                  <div>
                    <h3 className="text-[15px] font-semibold text-paper">Bez dôkazu</h3>
                    <ul className="mt-3 space-y-4">
                      {assessment.unsupported_claims.map((claim) => (
                        <li key={`${claim.turn_seq}-${claim.claim}`}>
                          <FounderQuote text={claim.claim} seq={claim.turn_seq} />
                          <p className="mt-1 text-[14.5px] leading-relaxed text-mute">Chýba: {claim.why}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {assessment.data_gaps.length > 0 ? (
                  <div className="lg:col-span-2">
                    <h3 className="text-[15px] font-semibold text-paper">Investor sa pýtal na údaje, ktoré v podkladoch nie sú</h3>
                    <ul className="mt-3 space-y-1.5 text-paper/90">
                      {assessment.data_gaps.map((gap) => (
                        <li key={gap} className="flex gap-3">
                          <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-marker" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                    <Link href={links.materials} className="link-underline mt-3 inline-block text-sm text-mute hover:text-paper">
                      Doplniť údaje do projektu
                    </Link>
                  </div>
                ) : null}
              </div>
            </ReportSection>
          ) : null}

          {assessment.pitch_coverage ? (
            <ReportSection id="coverage" title="Štruktúra pitchu" provenance="ai">
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {assessment.pitch_coverage.map((item) => (
                  <div key={item.element}>
                    <dt className="flex items-center justify-between gap-3">
                      <span className="font-medium text-paper">{PITCH_ELEMENT_LABELS[item.element]}</span>
                      <span className={`text-[13.5px] ${COVERAGE[item.status].className}`}>{COVERAGE[item.status].label}</span>
                    </dt>
                    <dd className="mt-1 text-[14.5px] leading-relaxed text-mute">{item.note}</dd>
                  </div>
                ))}
              </dl>
            </ReportSection>
          ) : null}
        </>
      ) : null}

      {measured ? (
        <ReportSection
          id="delivery"
          title="Hlas a prednes"
          provenance="measured"
          intro={
            measured.transport === "text"
              ? "Textový tréning: tempo, pauzy a hlas sa nemerali."
              : "Čísla vypočítané z prepisu a časovania. Orientačné signály z mikrofónu sú označené zvlášť."
          }
        >
          {measured.transport === "realtime" ? (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                <Stat
                  label="Tempo reči (medián)"
                  value={measured.pace.medianWpm !== null ? `${Math.round(measured.pace.medianWpm)}` : "–"}
                  note="slov za minútu"
                />
                <Stat
                  label="Dĺžka odpovede (medián)"
                  value={measured.answerLength.medianSeconds !== null ? formatDuration(measured.answerLength.medianSeconds) : "–"}
                  note={`cieľ scenára do ${measured.answerLength.targetSeconds} s`}
                />
                <Stat label="Nábeh na odpoveď (medián)" value={seconds(measured.latency.medianMs)} note="od konca otázky" />
                <Stat
                  label="Výplňové slová"
                  value={measured.fillers.per100Words !== null ? formatNumber(measured.fillers.per100Words, 1) : String(measured.fillers.total)}
                  note={measured.fillers.per100Words !== null ? "na 100 slov, dolný odhad" : "spolu, dolný odhad"}
                />
              </dl>

              {measured.answers.length > 0 ? (
                <div className="mt-10">
                  <ColumnChart
                    title="Dĺžka jednotlivých odpovedí"
                    unit="s"
                    target={measured.answerLength.targetSeconds}
                    attentionLabel="nad cieľom"
                    columns={measured.answers
                      .filter((answer) => answer.speechSeconds !== null)
                      .map((answer, index) => ({
                        key: String(answer.seq),
                        label: String(index + 1),
                        value: answer.speechSeconds ?? 0,
                        attention: answer.overTarget,
                        detail: `${answer.words} slov${answer.wordsPerMinute ? `, ${Math.round(answer.wordsPerMinute)} slov/min` : ""}${answer.fillers ? `, ${answer.fillers} výplňových slov` : ""}`,
                      }))}
                  />
                </div>
              ) : null}

              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
                <Stat label="Dlhé pauzy v odpovediach" value={String(measured.pauses.longPauses)} note="pauza nad 2,5 s" />
                <Stat label="Najdlhšia pauza" value={seconds(measured.pauses.longestMs)} />
                <Stat
                  label={<span className="inline-flex items-center gap-2">Variabilita hlasitosti <ProvenanceTag kind="indicative" /></span>}
                  value={measured.voice.volumeVariabilityDb !== null ? `${formatNumber(measured.voice.volumeVariabilityDb, 1)} dB` : "–"}
                />
                <Stat
                  label={<span className="inline-flex items-center gap-2">Variabilita výšky hlasu <ProvenanceTag kind="indicative" /></span>}
                  value={measured.voice.pitchVariabilitySemitones !== null ? `${formatNumber(measured.voice.pitchVariabilitySemitones, 1)} pt` : "–"}
                  note={measured.voice.pitchReliableAnswers > 0 ? `z ${measured.voice.pitchReliableAnswers} odpovedí s dostatkom znelej reči` : "málo znelej reči na odhad"}
                />
              </dl>
            </>
          ) : null}

          {observations.length > 0 ? (
            <ul className="mt-10 grid gap-3 md:grid-cols-2">
              {observations
                .filter((observation) => observation.area !== "camera")
                .map((observation) => (
                  <li
                    key={observation.id}
                    className={`rounded-[12px] border p-4 ${
                      observation.tone === "attention" ? "border-marker/35 bg-marker/[0.05]" : observation.tone === "positive" ? "border-mint/30" : "border-line"
                    }`}
                  >
                    <p className="flex flex-wrap items-center gap-2 font-medium text-paper">
                      {observation.title}
                      {observation.reliability === "indicative" ? <ProvenanceTag kind="indicative" /> : null}
                    </p>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-mute">{observation.detail}</p>
                  </li>
                ))}
            </ul>
          ) : null}
        </ReportSection>
      ) : null}

      {measured && session.camera_enabled ? (
        <ReportSection
          id="nonverbal"
          title="Neverbálne signály"
          provenance="indicative"
          intro="Odhad z polohy tváre a tela v prehliadači. Nejde o meranie očného kontaktu ani o hodnotenie osoby."
        >
          {measured.visual ? (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                <Stat label="Tvár v zábere" value={percent(measured.visual.faceVisibleRatio)} note="podiel snímok" />
                <Stat label="Hlava natočená ku kamere" value={percent(measured.visual.facingCameraRatio)} note="orientačne" />
                <Stat label="Pohľad smerom ku kamere" value={percent(measured.visual.gazeTowardCameraRatio)} note="hrubý odhad" />
                <Stat label="Viditeľné ruky" value={percent(measured.visual.handsVisibleRatio)} note="ak boli v zábere" />
              </dl>
              {measured.visual.framingIssues.length > 0 ? (
                <p className="mt-6 text-[14.5px] text-mute">
                  Rámovanie: {measured.visual.framingIssues.map((issue) => FRAMING_LABELS[issue] ?? issue).join(", ")}.
                </p>
              ) : null}
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {observations
                  .filter((observation) => observation.area === "camera")
                  .map((observation) => (
                    <li key={observation.id} className="rounded-[12px] border border-line p-4">
                      <p className="font-medium text-paper">{observation.title}</p>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-mute">{observation.detail}</p>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-mute">Z kamery sa neuložili žiadne signály (analýza sa nespustila alebo bola vypnutá).</p>
          )}
        </ReportSection>
      ) : null}

      {assessment && assessment.weaknesses.length > 0 ? (
        <ReportSection
          id="plan"
          title="Plán zlepšenia"
          provenance="ai"
          intro="Najdôležitejšie slabiny s ukážkou pôvodnej odpovede. Ku každej sme pripravili cvičenie."
        >
          <ol className="space-y-10">
            {assessment.weaknesses.map((weakness, index) => {
              const exercise = sessionExercises.find((item) => item.title === weakness.exercise.title.slice(0, 160));
              return (
                <li key={`${weakness.turn_seq}-${weakness.title}`} className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-4">
                    <p className="text-[13px] text-faint">Slabina {index + 1}</p>
                    <h3 className="type-heading mt-1 text-[1.25rem]">{weakness.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-mute">{weakness.problem}</p>
                  </div>
                  <div className="space-y-4 lg:col-span-8">
                    <div>
                      <p className="mb-1.5 text-[13px] text-faint">Tvoja odpoveď</p>
                      <FounderQuote text={weakness.original_excerpt} seq={weakness.turn_seq} />
                    </div>
                    <div className="rounded-[12px] border border-line bg-panel/60 p-4">
                      <p className="text-[13px] text-faint">Ako by to mohlo znieť (iba z tvojich údajov)</p>
                      <p className="mt-1.5 leading-relaxed text-paper/90">{weakness.improved_example}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {exercise ? (
                        <Link href={links.exercise(exercise.id)} className={buttonClasses({ variant: "secondary" })}>
                          Precvičiť: {EXERCISE_CATEGORY_LABELS[weakness.exercise.category].toLowerCase()}
                        </Link>
                      ) : (
                        <span className="text-[14px] text-faint">{weakness.exercise.title}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={links.retest} className={buttonClasses({ size: "lg" })}>
              Over zlepšenie v novej simulácii
            </Link>
            <Link href={links.exercises} className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Všetky cvičenia
            </Link>
          </div>
        </ReportSection>
      ) : null}

      <ReportSection id="reliability" title="Spoľahlivosť rozboru">
        <ul className="space-y-2 text-[14.5px] leading-relaxed text-mute">
          {(measured?.dataQuality ?? []).map((note) => (
            <li key={note} className="flex gap-3">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-line-strong" />
              {note}
            </li>
          ))}
          {assessment?.uncertainty ? (
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-line-strong" />
              {assessment.uncertainty}
            </li>
          ) : null}
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-line-strong" />
            Rozbor hodnotí odpovede v tréningu. Nie je to predpoveď, ako sa rozhodne skutočný investor.
          </li>
        </ul>
      </ReportSection>

      <ReportSection id="transcript" title="Prepis">
        <details>
          <summary className="text-mute">Zobraziť celý prepis ({turns.length} ťahov)</summary>
          <ol className="mt-6 space-y-5">
            {turns.map((turn) => (
              <li key={turn.seq} id={`tah-${turn.seq}`} className="scroll-mt-24">
                <p className="text-[12.5px] text-faint">
                  {turn.speaker === "investor" ? "Investor" : `Ty, odpoveď ${turn.seq}`}
                  {turn.interrupted ? <span className="ml-2 text-marker">prerušené</span> : null}
                </p>
                <p className={`mt-1 leading-relaxed ${turn.speaker === "investor" ? "type-investor text-[1.05rem] text-paper" : "text-paper/85"}`}>
                  {turn.text || <span className="text-faint">(bez prepisu)</span>}
                </p>
              </li>
            ))}
          </ol>
        </details>
      </ReportSection>

      {preview ? null : (
      <div className="mt-6 border-t border-line/70 pt-8">
        <ConfirmAction
          trigger="Zmazať tréning"
          title="Zmazať tento tréning?"
          description="Zmaže sa prepis, merania aj rozbor. Spotrebované minúty sa nevrátia."
          confirmLabel="Zmazať natrvalo"
          pendingLabel="Mažem…"
          action={deleteSessionAction.bind(null, session.id)}
        />
      </div>
      )}
    </>
  );
}

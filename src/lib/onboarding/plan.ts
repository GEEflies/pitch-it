import { z } from "zod";
import { STAGES, type CoachFocus, type Stage, type TrainingMode } from "@/lib/domain/labels";
import type { InvestorKey, ScenarioKey } from "@/lib/investor/catalog";

/*
  Úvodný kvíz: odpovede a z nich odvodený plán tréningu. Čisté funkcie, rovnaký
  výpočet beží na serveri (uloženie) aj v prehliadači (obrazovka plánu).
*/

export const RAISE_RANGES = ["under_100k", "100k_500k", "500k_2m", "over_2m", "not_sure"] as const;
export type RaiseRange = (typeof RAISE_RANGES)[number];

export const MEETING_TIMINGS = ["this_week", "this_month", "later", "no_date"] as const;
export type MeetingTiming = (typeof MEETING_TIMINGS)[number];

export const WORRIES = ["tough_questions", "numbers", "story", "delivery", "nerves"] as const;
export type Worry = (typeof WORRIES)[number];

export const EXPERIENCE_LEVELS = ["never", "few", "regular"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const ANSWERS_VERSION = 1;

export const onboardingAnswersSchema = z.object({
  stage: z.enum(STAGES),
  raise: z.enum(RAISE_RANGES),
  meeting: z.enum(MEETING_TIMINGS),
  worries: z.array(z.enum(WORRIES)).min(1).max(WORRIES.length),
  experience: z.enum(EXPERIENCE_LEVELS),
});

export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;

export const onboardingSubmissionSchema = onboardingAnswersSchema.extend({
  startupName: z.string().trim().min(1, "Zadaj názov startupu.").max(120, "Najviac 120 znakov."),
});

export type OnboardingSubmission = z.infer<typeof onboardingSubmissionSchema>;

export const RAISE_LABELS: Record<RaiseRange, string> = {
  under_100k: "Do 100 tis. €",
  "100k_500k": "100 – 500 tis. €",
  "500k_2m": "0,5 – 2 mil. €",
  over_2m: "Viac ako 2 mil. €",
  not_sure: "Ešte neviem",
};

export const MEETING_LABELS: Record<MeetingTiming, string> = {
  this_week: "Tento týždeň",
  this_month: "Do mesiaca",
  later: "Neskôr",
  no_date: "Zatiaľ nemám termín",
};

export const WORRY_LABELS: Record<Worry, string> = {
  tough_questions: "Ťažké a nečakané otázky",
  numbers: "Čísla a financie",
  story: "Jasný a presvedčivý príbeh",
  delivery: "Prejav, tempo a reč tela",
  nerves: "Nervozita a sebaistota",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  never: "Ešte nikdy",
  few: "Párkrát",
  regular: "Pravidelne",
};

export type TrainingPlan = {
  /** Počet tréningov do stretnutia. */
  sessions: number;
  /** Počet cielených cvičení. */
  exercises: number;
  /** Do kedy plán trvá, ľudsky. */
  horizon: string;
  /** Na čo sa plán zameria, v poradí dôležitosti. */
  focus: Worry[];
  firstSession: {
    investorKey: InvestorKey;
    scenarioKey: ScenarioKey;
    mode: TrainingMode;
  };
  coachFocus: CoachFocus[];
  /** Kroky plánu v poradí. */
  steps: Array<{ title: string; detail: string }>;
};

const SESSIONS_BY_MEETING: Record<MeetingTiming, number> = { this_week: 3, this_month: 5, later: 6, no_date: 4 };

const HORIZON: Record<MeetingTiming, string> = {
  this_week: "do konca týždňa",
  this_month: "na najbližšie 4 týždne",
  later: "na najbližšie 2 mesiace",
  no_date: "na najbližší mesiac",
};

/** Poradie dôležitosti obáv: najprv obsah, potom prejav. */
const WORRY_PRIORITY: Worry[] = ["numbers", "tough_questions", "story", "delivery", "nerves"];

const INVESTOR_FOR_WORRY: Record<Worry, InvestorKey> = {
  numbers: "financial",
  tough_questions: "generalist",
  story: "market",
  delivery: "generalist",
  nerves: "generalist",
};

const LATE_STAGES: Stage[] = ["series_a", "series_b_plus"];

/** Slovenské skloňovanie: „Ďalší 1 tréning“, „Ďalšie 3 tréningy“, „Ďalších 5 tréningov“. */
function moreSessionsTitle(count: number): string {
  if (count === 1) return "Ďalší 1 tréning";
  if (count < 5) return `Ďalšie ${count} tréningy`;
  return `Ďalších ${count} tréningov`;
}

export function buildTrainingPlan(answers: OnboardingAnswers): TrainingPlan {
  const focus = WORRY_PRIORITY.filter((worry) => answers.worries.includes(worry));
  const primary = focus[0] ?? "tough_questions";
  const novice = answers.experience === "never";

  let mode: TrainingMode = novice || primary === "nerves" ? "coach" : "simulation";
  let scenarioKey: ScenarioKey;
  if (primary === "delivery") {
    mode = "delivery";
    scenarioKey = "pitch_5";
  } else if (LATE_STAGES.includes(answers.stage)) {
    scenarioKey = "partner_meeting";
  } else if (novice && (answers.stage === "idea" || answers.stage === "pre_seed")) {
    scenarioKey = "angel_coffee";
  } else {
    scenarioKey = "first_meeting";
  }

  const coachFocus: CoachFocus[] = [];
  if (answers.worries.includes("nerves")) coachFocus.push("pace", "fillers");
  if (answers.worries.includes("delivery")) coachFocus.push("camera_gaze", "framing");
  if (coachFocus.length === 0) coachFocus.push("pace", "answer_length");

  const sessions = SESSIONS_BY_MEETING[answers.meeting];
  const exercises = Math.min(4, focus.length + 1);

  const steps: TrainingPlan["steps"] = [
    {
      title: "Prvý rozhovor s investorom",
      detail: novice
        ? "Režim s trénerom: investor sa pýta a počas odpovedí ti dávame jemné tipy."
        : "Realistická simulácia: investor sa pýta, dopytuje a prerušuje ako na skutočnom stretnutí.",
    },
    {
      title: "Rozbor a cielené cvičenia",
      detail: `Po tréningu dostaneš rozbor s citáciami a ${exercises} ${exercises === 1 ? "cvičenie" : "cvičenia"} na slabé miesta.`,
    },
    {
      title: moreSessionsTitle(sessions - 1),
      detail: "Iní investori a scenáre, aby si si zvykol na rôzne otázky. Zlepšenie uvidíš v porovnaní tréningov.",
    },
  ];

  return {
    sessions,
    exercises,
    horizon: HORIZON[answers.meeting],
    focus: focus.length > 0 ? focus : ["tough_questions"],
    firstSession: { investorKey: INVESTOR_FOR_WORRY[primary], scenarioKey, mode },
    coachFocus,
    steps,
  };
}

/** URL nového tréningu predvyplnená podľa plánu. */
export function firstSessionHref(plan: TrainingPlan, projectId: string): string {
  const params = new URLSearchParams({
    projekt: projectId,
    investor: plan.firstSession.investorKey,
    scenar: plan.firstSession.scenarioKey,
    rezim: plan.firstSession.mode,
  });
  return `/app/trening/novy?${params.toString()}`;
}

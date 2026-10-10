/*
  Odporúčaný ďalší krok na dashboarde. Čistá funkcia nad reálnym stavom účtu,
  aby sa dala otestovať a aby odporúčanie nikdy nestálo na vymyslených dátach.
*/

export type RecommendationInput = {
  projects: Array<{ id: string; name: string; hasDeck: boolean; factCount: number }>;
  lastSession: {
    id: string;
    projectId: string;
    mode: "coach" | "simulation" | "delivery";
    investorKey: string;
    scenarioKey: string;
    status: string;
    reportStatus: string | null;
  } | null;
  openReportExercises: Array<{ id: string; title: string; sourceSessionId: string | null }>;
  completedExercisesSinceLastSession: number;
};

export type Recommendation =
  | { kind: "create_project"; title: string; reason: string; href: string; cta: string }
  | { kind: "add_materials"; title: string; reason: string; href: string; cta: string; secondaryHref: string }
  | { kind: "first_training"; title: string; reason: string; href: string; cta: string }
  | { kind: "view_report"; title: string; reason: string; href: string; cta: string }
  | { kind: "practice_weakness"; title: string; reason: string; href: string; cta: string }
  | { kind: "retest"; title: string; reason: string; href: string; cta: string };

export function recommendNextStep(input: RecommendationInput): Recommendation {
  const project = input.projects[0];
  if (!project) {
    return {
      kind: "create_project",
      title: "Opíš svoj startup",
      reason: "Investor sa pýta na tvoj trh, čísla a tím. Bez profilu startupu by kládol všeobecné otázky.",
      href: "/app/projekty/novy",
      cta: "Vytvoriť profil startupu",
    };
  }

  const last = input.lastSession;
  if (!last) {
    if (!project.hasDeck && project.factCount < 3) {
      return {
        kind: "add_materials",
        title: "Pridaj pitch deck alebo kľúčové čísla",
        reason: "Čím viac investor o startupe vie, tým konkrétnejšie sa pýta a tým presnejšie odhalí rozpory.",
        href: `/app/projekty/${project.id}/podklady`,
        cta: "Nahrať podklady",
        secondaryHref: `/app/trening/novy?projekt=${project.id}`,
      };
    }
    return {
      kind: "first_training",
      title: "Prvý tréning: prvé stretnutie s fondom",
      reason: "Začni v režime s nápovedou. Uvidíš, na čo sa investor pýta, a po skončení dostaneš rozbor.",
      href: `/app/trening/novy?projekt=${project.id}&rezim=coach`,
      cta: "Začať tréning",
    };
  }

  if (last.status === "completed" && (last.reportStatus === "pending" || last.reportStatus === "generating" || last.reportStatus === "failed")) {
    return {
      kind: "view_report",
      title: "Pozri si rozbor posledného tréningu",
      reason:
        last.reportStatus === "failed"
          ? "Rozbor sa nepodarilo pripraviť. Merania sú uložené a rozbor môžeš spustiť znova."
          : "Rozbor sa práve pripravuje.",
      href: `/app/trening/${last.id}`,
      cta: "Otvoriť report",
    };
  }

  const exercise =
    input.openReportExercises.find((item) => item.sourceSessionId === last.id) ?? input.openReportExercises[0];
  if (exercise && input.completedExercisesSinceLastSession < 2) {
    return {
      kind: "practice_weakness",
      title: `Precvič: ${exercise.title}`,
      reason: "Toto cvičenie vzniklo zo slabiny v tvojom poslednom rozhovore. Krátke opakovanie pred ďalšou simuláciou.",
      href: `/app/cvicenia/${exercise.id}`,
      cta: "Otvoriť cvičenie",
    };
  }

  const params = new URLSearchParams({
    projekt: last.projectId,
    rezim: last.mode === "coach" ? "simulation" : last.mode,
    investor: last.investorKey,
    scenar: last.scenarioKey,
    predosly: last.id,
  });
  return {
    kind: "retest",
    title: "Over zlepšenie v novej simulácii",
    reason:
      last.mode === "coach"
        ? "Rovnaký investor a scenár, tentoraz bez nápovedy. Porovnanie s minulým pokusom uvidíš v histórii."
        : "Rovnaký investor a scenár ako minule, aby sa dali pokusy porovnať.",
    href: `/app/trening/novy?${params.toString()}`,
    cta: "Pripraviť simuláciu",
  };
}

import type { ReactNode } from "react";
import Link from "next/link";
import { GettingStarted, type ChecklistItem } from "@/components/app/getting-started";
import { Icon, PlayIcon, type IconName } from "@/components/app/icons";
import type { ActivityItem, ProgressSeries, ReportTile, StatCard, Tip } from "@/lib/dashboard/overview";
import { STAGE_LABELS, type Currency, type Stage } from "@/lib/domain/labels";

export type DashboardStartup = {
  id: string;
  name: string;
  oneLiner: string | null;
  stage: Stage;
  traction: string | null;
  raiseAmount: number | null;
  raiseCurrency: Currency;
};

export type DashboardViewData = {
  trainingHref: string;
  stats: StatCard[];
  startup: DashboardStartup | null;
  activity: ActivityItem[];
  reports: ReportTile[];
  progress: ProgressSeries;
  tip: Tip;
  latestReportHref: string | null;
  /** ISO čas vykreslenia (rovnaké body grafu na serveri aj klientovi). */
  now: string;
  notice?: ReactNode;
  /** Prvé kroky nového účtu; hotové sa neukážu. */
  checklist?: ChecklistItem[];
  /** Prepis odkazov (ukážka mapuje /app na /ukazka). */
  href?: (path: string) => string;
};

/* ───────────── Spoločné časti ───────────── */

function IconBadge({ icon, tone, size = "md" }: { icon: IconName; tone: "lime" | "violet" | "amber"; size?: "sm" | "md" | "lg" }) {
  const tones = { lime: "bg-lime-tint text-accent", violet: "bg-violet-tint text-violet-soft", amber: "bg-amber-tint text-marker" };
  const sizes = { sm: "size-10 [&_svg]:size-[19px]", md: "size-11 [&_svg]:size-[21px]", lg: "size-[54px] [&_svg]:size-[24px]" };
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full ${tones[tone]} ${sizes[size]}`}>
      <Icon name={icon} />
    </span>
  );
}

function CardHeader({ id, title, action }: { id: string; title: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[17px] font-bold tracking-[-0.01em] text-paper">
        {title}
      </h2>
      {action ? (
        <Link href={action.href} className="text-[12.5px] text-periwinkle transition-colors hover:text-paper">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/* ───────────── Úvodná karta ───────────── */

function Hero({ recordHref, investorHref }: { recordHref: string; investorHref: string }) {
  return (
    <section aria-labelledby="hero-title" className="dash-hero relative isolate overflow-hidden rounded-[16px] border border-hero-line">
      {/* eslint-disable-next-line @next/next/no-img-element -- dekoratívne pozadie, rovnaký súbor ako na landingu */}
      <img src="/landing/hero.jpg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[75%_center]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/85 to-ink/10" />
      <div className="relative px-6 pt-7 pb-7 sm:px-[30px] sm:pt-9 sm:pb-[27px] md:max-w-[58%]">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-periwinkle uppercase">Tvoj rozvoj</p>
        <h2 id="hero-title" className="mt-3.5 text-[34px] leading-[1.06] font-extrabold tracking-[-0.015em] text-paper sm:text-[44px]">
          Tvoj ďalší tréning
          <span className="block text-accent">začína tu</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slide sm:text-[16px]">Nacvič pitch alebo si vyskúšaj náročné otázky investora.</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={recordHref}
            className="dash-cta inline-flex h-11 items-center gap-3 rounded-full bg-signal pr-5 pl-[26px] text-[15px] font-bold text-on-signal transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
        >
            <PlayIcon className="size-[17px]" />
            Nahrať pitch
            <Icon name="chevronRight" className="size-[18px]" strokeWidth={2.2} />
          </Link>
          <Link href={investorHref} className="text-[15px] font-semibold text-paper/80 underline-offset-4 transition-colors hover:text-paper hover:underline">
            Simulovať investora
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Karty s metrikami ───────────── */

const STAT_ICONS: Record<StatCard["icon"], IconName> = { star: "star", gauge: "gauge", chat: "chat", timer: "timer" };

function StatTile({ card }: { card: StatCard }) {
  const verdictColor = card.delta
    ? card.delta.verdict === "better"
      ? "text-accent"
      : card.delta.verdict === "worse"
        ? "text-coral"
        : "text-mute"
    : "";
  return (
    <li className="dash-card flex min-w-0 flex-col p-[18px]" title={card.hint ?? undefined}>
      <div className="flex items-center gap-3.5">
        <IconBadge icon={STAT_ICONS[card.icon]} tone={card.tone} />
        <h3 className="min-w-0 text-[14px] leading-tight font-semibold text-paper">{card.label}</h3>
      </div>
      <p className="mt-[18px] flex items-baseline gap-1.5 whitespace-nowrap">
        {card.value !== null ? (
          <>
            <span className="text-[32px] leading-none font-bold tracking-[-0.02em] text-paper tabular-nums">{card.value}</span>
            {card.unit ? <span className="text-[20px] leading-none text-mute">{card.unit}</span> : null}
            {card.hint ? <span className="sr-only">({card.hint})</span> : null}
          </>
        ) : (
          <span className="text-[32px] leading-none font-bold text-faint">–</span>
        )}
      </p>
      <p className="mt-auto flex items-center gap-2.5 pt-4 text-[11.5px] text-faint">
        {card.delta ? (
          <>
            <span className={`flex items-center gap-1.5 text-[14px] font-bold tabular-nums ${verdictColor}`}>
              <Icon
                name={card.delta.sign === "up" ? "arrowUp" : card.delta.sign === "down" ? "arrowDown" : "arrowRight"}
                className="size-[15px]"
                strokeWidth={2.2}
              />
              <span aria-hidden="true">{card.delta.text}</span>
              <span className="sr-only">{card.delta.description}</span>
            </span>
            <span aria-hidden="true" className="truncate">
              {card.note}
            </span>
          </>
        ) : (
          <span className="truncate text-[12px]">{card.note}</span>
        )}
      </p>
    </li>
  );
}

/* ───────────── Môj startup ───────────── */

function formatRaise(amount: number | null, currency: Currency): string | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function StartupCard({ startup, href }: { startup: DashboardStartup | null; href: (path: string) => string }) {
  if (!startup) {
    return (
      <section aria-labelledby="startup-title" className="dash-card p-[18px]">
        <CardHeader id="startup-title" title="Môj startup" />
        <div className="mt-4 rounded-[14px] border border-dashed border-line-strong px-5 py-7">
          <p className="text-[15px] font-semibold text-paper">Opíš svoj startup</p>
          <p className="mt-1 max-w-[30rem] text-[13.5px] leading-relaxed text-mute">
            Investor sa pýta na tvoj trh, čísla a tím. Bez profilu startupu by kládol všeobecné otázky.
          </p>
          <Link href={href("/app/projekty/novy")} className="mt-4 inline-flex h-10 items-center rounded-full bg-signal px-5 text-[14px] font-bold text-on-signal">
            Vytvoriť profil startupu
          </Link>
        </div>
      </section>
    );
  }
  const raise = formatRaise(startup.raiseAmount, startup.raiseCurrency);
  const columns: Array<{ icon: IconName; label: string; value: ReactNode }> = [
    {
      icon: "flag",
      label: "Fáza",
      value: (
        <>
          <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-signal" />
          {STAGE_LABELS[startup.stage]}
        </>
      ),
    },
    {
      icon: "mountain",
      label: "Trakcia",
      value: startup.traction ? (
        <>
          <Icon name="users" className="size-[15px] text-accent" />
          <span className="truncate" title={startup.traction}>
            {startup.traction}
          </span>
        </>
      ) : (
        <span className="text-faint">Nedoplnené</span>
      ),
    },
    { icon: "coins", label: "Fundraising", value: raise ?? <span className="text-faint">Nedoplnené</span> },
  ];
  return (
    <section aria-labelledby="startup-title" className="dash-card p-[18px]">
      <CardHeader id="startup-title" title="Môj startup" action={{ href: href(`/app/projekty/${startup.id}`), label: "Upraviť" }} />
      <div className="mt-[18px] rounded-[14px] border border-inner-line bg-inner px-4 pt-4 pb-4 sm:px-[18px]">
        <div className="flex items-center gap-4 pb-4">
          <span
            aria-hidden="true"
            className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(140deg,#b9f5c4,#7fdc93_55%,#4fb86a)] text-[22px] font-extrabold text-[#0f3a1c]"
          >
            {startup.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-paper">{startup.name}</p>
            {startup.oneLiner ? <p className="mt-0.5 line-clamp-2 text-[13.5px] text-mute">{startup.oneLiner}</p> : null}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 border-t border-inner-line pt-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-0 sm:divide-x sm:divide-inner-line">
          {columns.map((column, index) => (
            <div key={column.label} className={`min-w-0 ${index === 0 ? "sm:pr-4" : index === 1 ? "sm:px-4" : "sm:pl-4"}`}>
              <dt className="flex items-center gap-2.5 text-[12px] text-mute">
                <Icon name={column.icon} className="size-[17px] text-mute" strokeWidth={1.5} />
                {column.label}
              </dt>
              <dd className={`mt-2.5 flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium text-paper ${index === 1 ? "" : "whitespace-nowrap"}`}>{column.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ───────────── Posledná aktivita ───────────── */

const ACTIVITY_STYLE: Record<ActivityItem["kind"], { icon: IconName; tone: "lime" | "violet" | "amber" }> = {
  training: { icon: "check", tone: "lime" },
  report: { icon: "file", tone: "violet" },
  exercise: { icon: "bolt", tone: "amber" },
};

function ActivityCard({ items, href }: { items: ActivityItem[]; href: (path: string) => string }) {
  return (
    <section aria-labelledby="activity-title" className="dash-card p-[18px]">
      <CardHeader id="activity-title" title="Posledná aktivita" action={items.length > 0 ? { href: href("/app/historia"), label: "Zobraziť všetko" } : undefined} />
      {items.length === 0 ? (
        <p className="mt-4 text-[13.5px] leading-relaxed text-mute">Zatiaľ žiadna aktivita. Po prvom tréningu tu uvidíš jeho priebeh, rozbor a cvičenia.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.map((item) => {
            const style = ACTIVITY_STYLE[item.kind];
            return (
              <li key={item.key}>
                <Link href={href(item.href)} className="group -mx-2 flex items-center gap-4 rounded-[10px] px-2 py-3 transition-colors hover:bg-panel-2/60">
                  <IconBadge icon={style.icon} tone={style.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-paper">{item.title}</span>
                    <span className="mt-1 block truncate text-[12px] text-mute">{item.meta}</span>
                  </span>
                  <Icon name="chevronRight" className="size-[18px] text-mute transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────────── Nedávne reporty ───────────── */

function ScoreRing({ score }: { score: NonNullable<ReportTile["score"]> }) {
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const color = score.tone === "good" ? "var(--color-accent)" : score.tone === "mid" ? "var(--color-marker)" : "var(--color-coral)";
  return (
    <span className="relative inline-flex size-[42px] shrink-0 items-center justify-center" title={score.label}>
      <svg viewBox="0 0 42 42" aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--color-ring-track)" strokeWidth="3" />
        <circle
          cx="21"
          cy="21"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(score.value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span aria-hidden="true" className="text-[13px] font-bold tabular-nums" style={{ color }}>
        {score.value}
      </span>
      <span className="sr-only">{score.label}</span>
    </span>
  );
}

function ReportsCard({ reports, href }: { reports: ReportTile[]; href: (path: string) => string }) {
  return (
    <section aria-labelledby="reports-title" className="dash-card p-[18px]">
      <CardHeader id="reports-title" title="Nedávne reporty" action={reports.length > 0 ? { href: href("/app/historia"), label: "Zobraziť všetky" } : undefined} />
      {reports.length === 0 ? (
        <p className="mt-4 text-[13.5px] leading-relaxed text-mute">Po prvom tréningu tu nájdeš rozbor: čo fungovalo, kde odpovede neobstáli a čo precvičiť.</p>
      ) : (
        <ul className="mt-4 grid gap-3.5 md:grid-cols-3">
          {reports.map((report) => (
            <li key={report.id} className="min-w-0">
              <Link
                href={href(report.href)}
                className="block h-full rounded-[12px] border border-line bg-tile p-3.5 transition-colors hover:border-line-strong hover:bg-panel-2/60"
              >
                <div className="flex items-start gap-3">
                  <IconBadge icon={report.icon} tone="violet" size="sm" />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-[13.5px] font-semibold text-paper">{report.title}</p>
                    <p className="mt-1 truncate text-[11.5px] text-mute">{report.meta}</p>
                  </div>
                  {report.score ? <ScoreRing score={report.score} /> : null}
                </div>
                {report.summary ? <p className="mt-3 line-clamp-2 text-[12px] leading-[1.55] text-mute">{report.summary}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────── Pravý stĺpec ───────────── */

/* ───────────── Kompozícia ───────────── */

export function DashboardView({
  trainingHref,
  stats,
  startup,
  activity,
  reports,
  notice = null,
  checklist = [],
  href = (path) => path,
}: DashboardViewData) {
  return (
    <div className="dash-enter space-y-5">
      {notice}
      <div className="min-w-0 space-y-[18px]">
          <Hero recordHref={href("/app/nahravka")} investorHref={href(trainingHref)} />
          <GettingStarted items={checklist} href={href} />
          <section aria-label="Výsledky posledného tréningu">
            <ul className="grid grid-cols-1 gap-[18px] min-[420px]:grid-cols-2 2xl:grid-cols-4">
              {stats.map((card) => (
                <StatTile key={card.key} card={card} />
              ))}
            </ul>
          </section>
          <div className="grid gap-[18px] lg:grid-cols-[minmax(0,53fr)_minmax(0,47fr)]">
            <StartupCard startup={startup} href={href} />
            <ActivityCard items={activity} href={href} />
          </div>
          <ReportsCard reports={reports} href={href} />
      </div>
    </div>
  );
}

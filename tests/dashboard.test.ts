import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PLANS, emptyUsage } from "../src/lib/billing/plans.ts";
import { planSummary } from "../src/lib/billing/summary.ts";
import { buildNotifications } from "../src/lib/dashboard/notifications.ts";
import {
  buildActivity,
  buildProgressSeries,
  buildRecentReports,
  buildStatCards,
  buildTip,
  defaultProgressRange,
  formatDelta,
  pointsInRange,
  progressChange,
  shareFor,
  trainingHref,
  type DashboardSession,
} from "../src/lib/dashboard/overview.ts";
import type { Recommendation } from "../src/lib/dashboard/recommendation.ts";
import { PREVIEW_ASSESSMENT, PREVIEW_MEASURED } from "../src/lib/preview/fixtures.ts";
import { previewDashboard } from "../src/lib/preview/dashboard.ts";

const NOW = new Date("2026-10-10T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function session(over: Partial<DashboardSession> & { answered?: [number, number]; wpm?: number; fillers?: number }): DashboardSession {
  const { answered = [3, 4], wpm = 150, fillers = 4, ...rest } = over;
  return {
    id: "s1",
    mode: "coach",
    transport: "realtime",
    status: "completed",
    createdAt: daysAgo(1),
    endedAt: daysAgo(1),
    billedSeconds: 180,
    report: {
      status: "ready",
      completedAt: rest.createdAt ?? daysAgo(1),
      measured: { ...PREVIEW_MEASURED, pace: { ...PREVIEW_MEASURED.pace, medianWpm: wpm }, fillers: { ...PREVIEW_MEASURED.fillers, per100Words: fillers } },
      assessment: {
        ...PREVIEW_ASSESSMENT,
        questions: Array.from({ length: answered[1] }, (_, index) => ({
          investor_turn_seq: index,
          topic: "t",
          answer_turn_seqs: [],
          verdict: index < answered[0] ? ("answered" as const) : ("evaded" as const),
          note: "",
        })),
      },
    },
    ...rest,
  };
}

const recommendation: Recommendation = {
  kind: "practice_weakness",
  title: "Precvič: CAC",
  reason: "Zo slabiny v poslednom rozhovore.",
  href: "/app/cvicenia/x",
  cta: "Otvoriť cvičenie",
};

describe("shareFor", () => {
  test("counts only fully answered questions", () => {
    assert.deepEqual(shareFor(session({ answered: [7, 9] })), { percent: (7 / 9) * 100, count: 7, total: 9 });
  });

  test("no ready report means no share", () => {
    assert.equal(shareFor(session({ report: null })), null);
  });
});

describe("formatDelta", () => {
  test("relative change with Slovak minus and non-breaking space", () => {
    assert.deepEqual(formatDelta(6, 7, "relative"), { value: -14, text: "−14 %" });
    assert.deepEqual(formatDelta(145, 134, "relative"), { value: 8, text: "+8 %" });
  });

  test("relative change from zero is not shown", () => {
    assert.equal(formatDelta(3, 0, "relative"), null);
  });

  test("points for shares", () => {
    assert.equal(formatDelta(78, 66, "points")?.text, "+12 %");
  });
});

describe("buildStatCards", () => {
  test("empty account shows placeholders", () => {
    const { subject, cards } = buildStatCards([]);
    assert.equal(subject, null);
    assert.equal(cards.length, 4);
    assert.ok(cards.every((card) => card.value === null && card.note === "Po prvom tréningu"));
  });

  test("compares with the previous session of the same mode only", () => {
    const sessions = [
      session({ id: "new", createdAt: daysAgo(1), answered: [7, 9], wpm: 145, fillers: 6 }),
      session({ id: "sim", mode: "simulation", createdAt: daysAgo(2), answered: [1, 9], wpm: 200 }),
      session({ id: "old", createdAt: daysAgo(3), answered: [6, 9], wpm: 134, fillers: 7 }),
    ];
    const { subject, cards } = buildStatCards(sessions);
    assert.equal(subject?.id, "new");
    const [share, pace, fillers] = cards;
    assert.equal(share.label, "Zodpovedané otázky");
    assert.equal(share.value, "78");
    assert.equal(share.hint, "7 z 9 otázok");
    assert.equal(share.delta?.text, "+11 %");
    assert.equal(share.delta?.verdict, "better");
    assert.equal(pace.delta?.text, "+8 %");
    assert.equal(fillers.delta?.verdict, "better");
    assert.equal(fillers.delta?.sign, "down");
  });

  test("delivery switches the first card to pitch coverage", () => {
    const delivery = session({ mode: "delivery" });
    delivery.report!.assessment = {
      ...delivery.report!.assessment!,
      pitch_coverage: [
        { element: "problem", status: "clear", note: "" },
        { element: "market", status: "brief", note: "" },
      ],
    };
    const { family, cards } = buildStatCards([delivery]);
    assert.equal(family, "delivery");
    assert.equal(cards[0].label, "Pokrytie pitchu");
    assert.equal(cards[0].value, "50");
    assert.equal(cards[0].note, "Prvé meranie");
  });

  test("text sessions explain why voice metrics are missing", () => {
    const text = session({ transport: "text" });
    text.report!.measured = { ...text.report!.measured!, pace: { ...text.report!.measured!.pace, medianWpm: null } };
    const pace = buildStatCards([text]).cards[1];
    assert.equal(pace.value, null);
    assert.equal(pace.note, "Iba v hlasovom tréningu");
  });
});

describe("activity, reports, progress", () => {
  test("activity merges sessions and completed exercises, newest first", () => {
    const items = buildActivity(
      [session({ id: "a", createdAt: daysAgo(3), endedAt: daysAgo(3) }), session({ id: "b", mode: "delivery", createdAt: daysAgo(1), endedAt: daysAgo(1) })],
      [{ id: "e", title: "Konkurenčná výhoda", status: "completed", completedAt: daysAgo(2) }],
    );
    assert.deepEqual(
      items.map((item) => item.title),
      ["Dokončený tréning pitchu", "Cielené cvičenie", "Nový AI investor report"],
    );
    assert.match(items[2].meta, /^4 otázky · /);
  });

  test("report tiles carry the answered share as the ring value", () => {
    const [tile] = buildRecentReports([session({ answered: [7, 9] })]);
    assert.equal(tile.score?.value, 78);
    assert.equal(tile.score?.tone, "good");
    assert.equal(tile.title, "Tréning s nápovedou");
  });

  test("progress picks the shortest range with two points", () => {
    const series = buildProgressSeries(
      [session({ id: "a", createdAt: daysAgo(20), answered: [2, 4] }), session({ id: "b", createdAt: daysAgo(2), answered: [3, 4] })],
      "conversation",
    );
    assert.equal(defaultProgressRange(series.points, NOW), "30");
    assert.equal(pointsInRange(series.points, "7", NOW).length, 1);
    assert.equal(progressChange(series.points), 25);
  });
});

describe("tip and training link", () => {
  test("tip comes from a measured observation when there is one", () => {
    const tip = buildTip(session({ wpm: 190 }), recommendation);
    assert.equal(tip.source, "measured");
    assert.equal(tip.title, "Spomaľ pri kľúčových číslach.");
  });

  test("tip falls back to the recommendation", () => {
    const tip = buildTip(null, recommendation);
    assert.equal(tip.source, "recommendation");
    assert.equal(tip.title, "Precvič: CAC.");
  });

  test("hero opens the prepared retest or the training picker", () => {
    assert.equal(trainingHref({ ...recommendation, kind: "retest", href: "/app/trening/novy?predosly=1" }, "p"), "/app/trening/novy?predosly=1");
    assert.equal(trainingHref(recommendation, "p"), "/app/trening/novy?projekt=p");
    assert.equal(trainingHref(recommendation, null), "/app/trening/novy");
  });
});

describe("planSummary", () => {
  test("free plan shows remaining minutes and upgrade", () => {
    const summary = planSummary({ plan: PLANS.free, usage: { ...emptyUsage(), realtime_seconds: 5 * 60 }, subscription: null }, NOW);
    assert.equal(summary.title, "Free plán");
    assert.equal(summary.detail, "Zostáva 15 z 20 min");
    assert.equal(summary.action.label, "Upgradovať");
  });

  test("trial counts days left with correct Slovak forms", () => {
    const trial = (days: number) =>
      planSummary(
        {
          plan: PLANS.pro,
          usage: emptyUsage(),
          subscription: { plan: "pro", status: "trialing", current_period_end: new Date(NOW.getTime() + days * 86_400_000).toISOString(), cancel_at_period_end: false },
        },
        NOW,
      ).detail;
    assert.equal(trial(12), "12 dní zostáva");
    assert.equal(trial(3), "3 dni zostávajú");
    assert.equal(trial(1), "1 deň zostáva");
  });

  test("active pro is managed, not upsold", () => {
    const summary = planSummary(
      { plan: PLANS.pro, usage: emptyUsage(), subscription: { plan: "pro", status: "active", current_period_end: null, cancel_at_period_end: false } },
      NOW,
    );
    assert.equal(summary.action.label, "Spravovať plán");
  });
});

describe("notifications and preview", () => {
  test("only ready reports become notifications", () => {
    const items = buildNotifications(
      [
        { id: "a", mode: "coach", created_at: daysAgo(2), feedback_reports: { status: "ready", completed_at: daysAgo(2) } },
        { id: "b", mode: "simulation", created_at: daysAgo(1), feedback_reports: { status: "generating", completed_at: null } },
      ],
      [{ id: "e", title: "CAC", created_at: daysAgo(1.5) }],
    );
    assert.deepEqual(
      items.map((item) => item.id),
      ["exercise-e", "report-a"],
    );
  });

  test("preview dashboard fills every section", () => {
    const data = previewDashboard(NOW);
    assert.equal(data.stats[0].value, "78");
    assert.equal(data.stats[1].value, "145");
    assert.equal(data.stats[2].delta?.text, "−14 %");
    assert.equal(data.reports.length, 3);
    assert.equal(data.activity.length, 3);
    assert.ok(pointsInRange(data.progress.points, "7", NOW).length >= 2);
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SCENARIOS } from "../src/lib/investor/catalog.ts";
import {
  buildTrainingPlan,
  firstSessionHref,
  onboardingSubmissionSchema,
  type OnboardingAnswers,
} from "../src/lib/onboarding/plan.ts";

const base: OnboardingAnswers = {
  stage: "seed",
  raise: "500k_2m",
  meeting: "this_month",
  worries: ["tough_questions"],
  experience: "few",
};

describe("buildTrainingPlan", () => {
  test("sessions follow the meeting date", () => {
    assert.equal(buildTrainingPlan({ ...base, meeting: "this_week" }).sessions, 3);
    assert.equal(buildTrainingPlan({ ...base, meeting: "later" }).sessions, 6);
  });

  test("numbers worry wins and picks the financial investor", () => {
    const plan = buildTrainingPlan({ ...base, worries: ["nerves", "numbers"] });
    assert.deepEqual(plan.focus, ["numbers", "nerves"]);
    assert.equal(plan.firstSession.investorKey, "financial");
    assert.deepEqual(plan.coachFocus, ["pace", "fillers"]);
  });

  test("first-time founders get coach mode and a gentler scenario", () => {
    const plan = buildTrainingPlan({ ...base, stage: "pre_seed", experience: "never" });
    assert.equal(plan.firstSession.mode, "coach");
    assert.equal(plan.firstSession.scenarioKey, "angel_coffee");
  });

  test("follow-up step title is declined correctly", () => {
    assert.equal(buildTrainingPlan({ ...base, meeting: "this_week" }).steps[2].title, "Ďalšie 2 tréningy");
    assert.equal(buildTrainingPlan({ ...base, meeting: "later" }).steps[2].title, "Ďalších 5 tréningov");
  });

  test("later stages meet a partner", () => {
    assert.equal(buildTrainingPlan({ ...base, stage: "series_a" }).firstSession.scenarioKey, "partner_meeting");
  });

  test("delivery as main worry runs a timed pitch in delivery mode", () => {
    const plan = buildTrainingPlan({ ...base, worries: ["delivery"] });
    assert.equal(plan.firstSession.mode, "delivery");
    assert.ok(SCENARIOS[plan.firstSession.scenarioKey].modes.includes("delivery"));
  });

  test("the chosen scenario always supports the chosen mode", () => {
    for (const experience of ["never", "few", "regular"] as const) {
      for (const worries of [["nerves"], ["story"], ["delivery"], ["numbers", "delivery"]] as OnboardingAnswers["worries"][]) {
        const plan = buildTrainingPlan({ ...base, experience, worries });
        assert.ok(SCENARIOS[plan.firstSession.scenarioKey].modes.includes(plan.firstSession.mode), `${experience} ${worries}`);
      }
    }
  });

  test("href pre-fills the training setup", () => {
    const href = firstSessionHref(buildTrainingPlan(base), "p1");
    assert.equal(href, "/app/trening/novy?projekt=p1&investor=generalist&scenar=first_meeting&rezim=simulation");
  });
});

describe("onboardingSubmissionSchema", () => {
  test("requires at least one worry and a startup name", () => {
    assert.equal(onboardingSubmissionSchema.safeParse({ ...base, worries: [], startupName: "X" }).success, false);
    assert.equal(onboardingSubmissionSchema.safeParse({ ...base, startupName: "  " }).success, false);
    assert.equal(onboardingSubmissionSchema.safeParse({ ...base, startupName: "Faktúrka" }).success, true);
  });
});

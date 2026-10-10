import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ANSWERS,
  onboardingSubmissionSchema,
  planSummary,
  QUESTIONS,
  readAnswers,
} from "../src/lib/onboarding/plan.ts";

describe("úvodný kvíz", () => {
  test("má tri otázky: 4 publiká, 3 dĺžky, 3 zamerania", () => {
    assert.deepEqual(
      QUESTIONS.map((question) => question.options.length),
      [4, 3, 3],
    );
  });

  test("zhrnutie plánu používa krátke názvy", () => {
    assert.deepEqual(planSummary({ audience: "team", lengthSeconds: 30, focus: "obsah" }), {
      audience: "Tímu",
      length: "30 sekúnd",
      first: "Obsah",
    });
  });

  test("poznámky sú voliteľné a obmedzené dĺžkou", () => {
    const base = { audience: "investor", lengthSeconds: 60, focus: "tempo" };
    const parsed = onboardingSubmissionSchema.safeParse(base);
    assert.equal(parsed.success && parsed.data.notes, "");
    assert.equal(onboardingSubmissionSchema.safeParse({ ...base, notes: "x".repeat(4001) }).success, false);
    assert.equal(onboardingSubmissionSchema.safeParse({ ...base, lengthSeconds: 45 }).success, false);
  });

  test("staršie odpovede (verzia 1) nahradí predvolenými", () => {
    assert.deepEqual(readAnswers({ version: 1, stage: "seed", meeting: "this_week" }), DEFAULT_ANSWERS);
    assert.deepEqual(readAnswers({ version: 2, audience: "team", lengthSeconds: 30, focus: "obsah" }), {
      audience: "team",
      lengthSeconds: 30,
      focus: "obsah",
    });
  });
});

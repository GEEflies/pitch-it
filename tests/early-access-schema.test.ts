import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  normalizeEmail,
  sanitizeUtm,
  validateEarlyAccess,
} from "../src/lib/early-access/schema.ts";

const valid = {
  email: "  Zakladatel@Startup.SK ",
  stage: "seed",
  nextMeeting: "",
  consent: "on",
};

describe("validateEarlyAccess", () => {
  test("prijme platný vstup a normalizuje e-mail", () => {
    const result = validateEarlyAccess(valid);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        email: "zakladatel@startup.sk",
        stage: "seed",
        nextMeeting: null,
      });
    }
  });

  test("prijme súhlas ako boolean z klienta", () => {
    const result = validateEarlyAccess({ ...valid, consent: true, nextMeeting: "within_2_weeks" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.nextMeeting, "within_2_weeks");
  });

  test("vráti chyby pre všetky povinné polia", () => {
    const result = validateEarlyAccess({ email: "", stage: "", nextMeeting: "", consent: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.email);
      assert.ok(result.errors.stage);
      assert.ok(result.errors.consent);
      assert.equal(result.errors.nextMeeting, undefined);
    }
  });

  for (const email of ["bez-zavinaca.sk", "a@b", "a@.sk", "a b@startup.sk", "a@startup.s", "a@@startup.sk"]) {
    test(`odmietne neplatný e-mail: ${email}`, () => {
      const result = validateEarlyAccess({ ...valid, email });
      assert.equal(result.ok, false);
      if (!result.ok) assert.ok(result.errors.email);
    });
  }

  test("odmietne príliš dlhý e-mail", () => {
    const result = validateEarlyAccess({ ...valid, email: `${"a".repeat(250)}@startup.sk` });
    assert.equal(result.ok, false);
  });

  test("odmietne hodnoty mimo ponuky (podvrhnutý formulár)", () => {
    const result = validateEarlyAccess({ ...valid, stage: "unicorn", nextMeeting: "tomorrow" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.stage);
      assert.ok(result.errors.nextMeeting);
    }
  });

  test("odmietne iné typy než string", () => {
    const result = validateEarlyAccess({ email: 42, stage: ["seed"], nextMeeting: {}, consent: "yes" });
    assert.equal(result.ok, false);
  });
});

describe("sanitizeUtm", () => {
  test("ponechá bezpečné hodnoty", () => {
    assert.equal(sanitizeUtm("linkedin"), "linkedin");
    assert.equal(sanitizeUtm("jesen-2026_v2"), "jesen-2026_v2");
  });

  test("zahodí podozrivé alebo prázdne hodnoty", () => {
    assert.equal(sanitizeUtm("<script>"), null);
    assert.equal(sanitizeUtm(""), null);
    assert.equal(sanitizeUtm(null), null);
  });

  test("oreže dĺžku na 100 znakov", () => {
    assert.equal(sanitizeUtm("x".repeat(150))?.length, 100);
  });
});

test("normalizeEmail oreže medzery a zmenší písmená", () => {
  assert.equal(normalizeEmail("  Ja@Firma.SK "), "ja@firma.sk");
});

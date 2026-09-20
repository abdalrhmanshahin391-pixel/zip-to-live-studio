import assert from "node:assert/strict";
import test from "node:test";
import {
  ritaVoiceInstructions,
  spokenDialectLabel,
  stableRitaDialect,
} from "./rita-voice-style.ts";

test("keeps a stable dialect when the new inference is weak", () => {
  assert.equal(
    stableRitaDialect({
      detected: "ar-EG",
      confidence: 0.4,
      previous: "ar-JO",
      preference: "",
      language: "ar",
    }),
    "ar-JO",
  );
});

test("explicit preference wins and a clear new dialect can replace the old one", () => {
  const args = {
    detected: "ar-EG",
    confidence: 0.9,
    previous: "ar-JO",
    preference: "",
    language: "ar",
  };
  assert.equal(stableRitaDialect(args), "ar-EG");
  assert.equal(stableRitaDialect({ ...args, preference: "ar-JO" }), "ar-JO");
});

test("does not carry a different language's accent into a new language", () => {
  assert.equal(
    stableRitaDialect({
      detected: "standard",
      confidence: 0.3,
      previous: "ar-JO",
      preference: "",
      language: "en",
    }),
    "standard",
  );
});

test("describes locale codes to the speech model in plain language", () => {
  assert.equal(spokenDialectLabel("ar"), "Arabic");
  assert.equal(spokenDialectLabel("ar-JO"), "Arabic as spoken in Jordan");
  assert.match(ritaVoiceInstructions("ar", "ar-JO", "warm"), /Arabic as spoken in Jordan/);
  assert.doesNotMatch(ritaVoiceInstructions("ar", "ar-JO", "warm"), /ar-JO/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { hasRitaLanguageLearningIntent } from "./rita-learning-intent.ts";

test("allows explicit translation and vocabulary requests", () => {
  assert.equal(hasRitaLanguageLearningIntent("What does Guten Morgen mean?"), true);
  assert.equal(hasRitaLanguageLearningIntent("اعطيني خمس كلمات ألماني"), true);
  assert.equal(hasRitaLanguageLearningIntent("Save these phrases to my flashcards"), true);
});

test("does not turn ordinary knowledge questions into vocabulary cards", () => {
  assert.equal(hasRitaLanguageLearningIntent("Tell me about the Mongol war"), false);
  assert.equal(hasRitaLanguageLearningIntent("شو صار بحرب المغول؟"), false);
  assert.equal(hasRitaLanguageLearningIntent("Why is the sky blue?"), false);
});

const UNCERTAIN_DIALECT = /^(unknown|standard|automatic|neutral|none)$/i;

function cleanLabel(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function baseLanguage(value: string) {
  return (
    cleanLabel(value)
      .match(/^([a-z]{2,3})(?:-|$)/i)?.[1]
      ?.toLowerCase() ?? ""
  );
}

export function stableRitaDialect(args: {
  detected: string;
  confidence: number;
  previous: string;
  preference: string;
  language: string;
}) {
  const preference = cleanLabel(args.preference);
  if (preference && !UNCERTAIN_DIALECT.test(preference)) return preference;

  const detected = cleanLabel(args.detected);
  const previous = cleanLabel(args.previous);
  if (detected && !UNCERTAIN_DIALECT.test(detected) && args.confidence >= 0.72) return detected;

  if (previous && !UNCERTAIN_DIALECT.test(previous)) {
    const previousLanguage = baseLanguage(previous);
    const currentLanguage = baseLanguage(args.language);
    if (!previousLanguage || !currentLanguage || previousLanguage === currentLanguage)
      return previous;
  }
  return "standard";
}

export function spokenDialectLabel(value: string) {
  const clean = cleanLabel(value);
  if (!clean || UNCERTAIN_DIALECT.test(clean)) return "";
  if (/^[a-z]{2,3}$/i.test(clean)) {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(clean.toLowerCase()) || clean;
    } catch {
      return clean;
    }
  }
  const locale = clean.match(/^([a-z]{2,3})-([a-z]{2}|[0-9]{3})$/i);
  if (!locale) return clean;
  try {
    const language = new Intl.DisplayNames(["en"], { type: "language" }).of(
      locale[1].toLowerCase(),
    );
    const region = new Intl.DisplayNames(["en"], { type: "region" }).of(locale[2].toUpperCase());
    return language && region ? `${language} as spoken in ${region}` : clean;
  } catch {
    return clean;
  }
}

export function ritaVoiceInstructions(language: string, dialect: string, emotion: string) {
  const accent = spokenDialectLabel(dialect);
  const spokenLanguage = spokenDialectLabel(language) || "the language of the supplied text";
  const style =
    emotion === "excited"
      ? "Sound genuinely pleased, not theatrical."
      : emotion === "playful"
        ? "Sound lightly playful, never sarcastic."
        : emotion === "thoughtful"
          ? "Sound attentive and thoughtful."
          : "Sound warm and relaxed.";
  return `You are Rita, a friendly tutor talking one-to-one, not reading a script. Speak naturally in ${accent || spokenLanguage}. Keep the exact colloquial wording and code-switching in the text. Use conversational rhythm, varied intonation, and brief natural pauses. ${style} Do not exaggerate an accent or add words.`;
}

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
  if (/\barabic\b/i.test(value)) return "ar";
  if (/\benglish\b/i.test(value)) return "en";
  return (
    cleanLabel(value)
      .match(/^([a-z]{2,3})(?:-|$)/i)?.[1]
      ?.toLowerCase() ?? ""
  );
}

// An explicit spoken request is stronger evidence than a dialect guess made
// from a text transcript. Keep the mapping small and allow other dialect names
// through as labels so the model can still honor them.
export function explicitRitaAccent(utterance: string) {
  const normalized = cleanLabel(utterance).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
  const arabic = normalized.match(
    /(?:باللهجه|باللهجة|بلهجه|بلهجة|اللهجه|اللهجة|لهجه|لهجة)\s+([\p{L}-]+)/u,
  );
  const english = normalized.match(
    /(jordanian|iraqi|egyptian|palestinian|lebanese|syrian|saudi|moroccan|tunisian|algerian|emirati|yemeni|sudanese|gulf)\s+(?:arabic\s+)?(?:accent|dialect)|(?:speak|talk)\s+(?:in|with)\s+(?:a\s+)?(jordanian|iraqi|egyptian|palestinian|lebanese|syrian|saudi|moroccan|tunisian|algerian|emirati|yemeni|sudanese|gulf)/i,
  );
  const requested = arabic?.[1] || english?.[1] || english?.[2] || "";
  if (!requested) return "";
  const accents: Array<[RegExp, string]> = [
    [/اردن|jordan/, "ar-JO"],
    [/عراق|iraq/, "ar-IQ"],
    [/مصر|egypt/, "ar-EG"],
    [/فلسطين|palestin/, "ar-PS"],
    [/لبنان|leban/, "ar-LB"],
    [/سور|syria/, "ar-SY"],
    [/سعود|saudi/, "ar-SA"],
    [/مغرب|morocc/, "ar-MA"],
    [/تونس|tunis/, "ar-TN"],
    [/جزائر|algeri/, "ar-DZ"],
    [/امارات|emirati/, "ar-AE"],
    [/يمن|yemen/, "ar-YE"],
    [/سودان|sudan/, "ar-SD"],
    [/خليج|gulf/, "Gulf Arabic"],
  ];
  return accents.find(([pattern]) => pattern.test(requested))?.[1] || requested.slice(0, 40);
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

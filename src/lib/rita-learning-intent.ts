const LANGUAGE_PATTERNS = [
  /(?:what does|what is the meaning of|translate|translation|how do (?:i|you) say)/i,
  /(?:شو|ما)\s+(?:معنى|يعني)|ترجم|ترجمة|كيف\s+(?:أحكي|أقول)/u,
  /(?:was bedeutet|übersetz|wie sagt man)/i,
  /(?:give|teach|show|اعط|أعط|علمني|هات).{0,24}(?:words?|phrases?|كلمات|جمل)/iu,
  /(?:save|add|احفظ|حط|ضيف).{0,40}(?:flashcards?|german lab|فلاش|مختبر)/iu,
];

export function hasRitaLanguageLearningIntent(text: string) {
  const clean = text.trim();
  return clean.length > 1 && LANGUAGE_PATTERNS.some((pattern) => pattern.test(clean));
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  cleanLanguage,
  estimateSpeechDurationMs,
  estimateTurnCostMicros,
  estimateWavDurationMs,
  getRitaAllowance,
  getRitaSettings,
  normalizePersonality,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 2_000;
const MAX_HISTORY = 8;

const PERSONALITY_INSTRUCTIONS = {
  kind: "Warm, patient, encouraging, and never patronizing.",
  direct: "Concise and candid about mistakes while remaining respectful.",
  playful: "Lightly witty, upbeat, and encouraging; never mock or embarrass the learner.",
  strict: "Structured and demanding with clear standards; never shame or humiliate the learner.",
} as const;

type HistoryItem = { role: "user" | "assistant"; content: string };
type TutorResult = {
  reply: string;
  detectedLanguage: string;
  detectedDialect: string;
  confidence: number;
  correction: string;
  emotion: "neutral" | "warm" | "encouraging" | "playful" | "thoughtful" | "excited";
  lessonAction: string;
};

function languageCode(value: string) {
  const normalized = value.toLowerCase();
  const code = normalized.match(/^[a-z]{2,3}(?:-[a-z]{2,4})?$/)?.[0];
  if (code) return code.split("-")[0];
  return null;
}

function safeHistory(raw: FormDataEntryValue | null): HistoryItem[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(-MAX_HISTORY)
      .filter((item) => item?.role === "user" || item?.role === "assistant")
      .map((item) => ({
        role: item.role,
        content: String(item.content ?? "")
          .trim()
          .slice(0, 600),
      }))
      .filter((item) => item.content);
  } catch {
    return [];
  }
}

function extractJson(text: string): TutorResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Partial<TutorResult>;
  const allowedEmotions = ["neutral", "warm", "encouraging", "playful", "thoughtful", "excited"];
  return {
    reply: String(parsed.reply ?? "")
      .trim()
      .slice(0, 2_000),
    detectedLanguage: String(parsed.detectedLanguage ?? "unknown").slice(0, 40),
    detectedDialect: String(parsed.detectedDialect ?? "standard").slice(0, 40),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
    correction: String(parsed.correction ?? "")
      .trim()
      .slice(0, 500),
    emotion: allowedEmotions.includes(String(parsed.emotion))
      ? (parsed.emotion as TutorResult["emotion"])
      : "warm",
    lessonAction: String(parsed.lessonAction ?? "Continue the conversation")
      .trim()
      .slice(0, 180),
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function systemPrompt(args: {
  personality: keyof typeof PERSONALITY_INSTRUCTIONS;
  language: string;
  accentPreference: string;
  accentHint: string;
  browserLocale: string;
  words: number;
}) {
  return `You are Rita, RitaJet's live language tutor. You are having a spoken lesson, not writing an essay.

Teaching style: ${PERSONALITY_INSTRUCTIONS[args.personality]}
Selected language: ${args.language}. If it is automatic, infer the learner's current language.
Explicit accent or region preference: ${args.accentPreference || "none"}. An explicit preference always wins.
Previous stable accent: ${args.accentHint || "unknown"}.
Browser locale hint: ${args.browserLocale || "unknown"}. Treat this as a weak hint, never as proof.

Language rules:
- Reply in the learner's selected language. In automatic mode, mirror the dominant language of the latest utterance.
- Support every language and regional variety equally. Infer regional vocabulary, dialect, register, slang, and code-switching from the learner's words and conversation context.
- Mirror the learner's familiar way of speaking: sound like a supportive local tutor they know, while remaining clear, respectful, and never caricaturing or stereotyping an accent.
- Preserve colloquial speech instead of automatically converting it to a formal standard variety. This includes all Arabic dialects, regional English, Spanish, French, Portuguese, German, Turkish, and any other language.
- Do not guess acoustic pronunciation from text. If the region is uncertain and no explicit preference exists, use a natural neutral variety and ask one short, friendly question about the learner's preferred country or accent.
- Do not replace a stable accent on weak evidence. Keep the previous stable accent when confidence is below 0.72.

Tutor rules:
- Give a natural answer first. Correct only useful mistakes, briefly, without interrupting the conversation.
- Ask at most one helpful follow-up question.
- Keep the spoken reply under ${args.words} words unless the learner explicitly asks for detail.
- Never mock, humiliate, harass, flirt with, or shame the learner.

Return one JSON object only with exactly these keys:
{"reply":"spoken response","detectedLanguage":"BCP-47 language code","detectedDialect":"specific BCP-47 regional variety or a concise accent label; any world region is allowed","confidence":0.0,"correction":"brief correction or empty string","emotion":"neutral|warm|encouraging|playful|thoughtful|excited","lessonAction":"short description of next teaching move"}`;
}

export const Route = createFileRoute("/api/rita/turn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const settings = await getRitaSettings();
        const allowance = await getRitaAllowance(auth.userId, settings);
        const apiKey = await resolveRitaOpenAiKey();
        if (!apiKey) return new Response("Rita’s OpenAI key is not configured.", { status: 503 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Invalid voice request", { status: 400 });
        }
        const personality = normalizePersonality(form.get("personality"));
        const language = cleanLanguage(form.get("language"));
        const accentHint = String(form.get("accentHint") ?? "").slice(0, 80);
        const accentPreference = String(form.get("accentPreference") ?? "")
          .trim()
          .slice(0, 80);
        const browserLocale = String(form.get("browserLocale") ?? "")
          .trim()
          .slice(0, 40);
        const sessionId = String(form.get("sessionId") ?? "");
        const history = safeHistory(form.get("history"));
        let transcript = String(form.get("text") ?? "")
          .trim()
          .slice(0, MAX_TEXT);
        const audio = form.get("audio");
        const hasAudio = audio instanceof File && audio.size > 0;
        if (hasAudio && !allowance.allowed) {
          return Response.json(
            {
              error:
                allowance.reason === "daily_guard"
                  ? "Today’s voice fair-use safeguard has been reached. Text chat is still available."
                  : "Rita voice is temporarily unavailable. Text chat is still available.",
              allowance,
            },
            { status: 429 },
          );
        }
        const premiumVoice = allowance.allowed && allowance.premiumVoice;
        let inputAudioMs = 0;

        if (hasAudio) {
          if (audio.size > MAX_AUDIO_BYTES)
            return new Response("That voice turn is too long.", { status: 413 });
          inputAudioMs = estimateWavDurationMs(audio);
          const transcription = new FormData();
          transcription.append("model", RITA_MODELS.transcription);
          transcription.append("file", audio, audio.name || "rita-turn.wav");
          const code = languageCode(language);
          if (code) transcription.append("language", code);
          transcription.append(
            "prompt",
            `This is a language-learning conversation. Preserve colloquial wording, regional vocabulary, code switching, slang, and proper names exactly. Preferred accent or region: ${accentPreference || "automatic"}. Previous stable accent: ${accentHint || "unknown"}.`,
          );
          const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: transcription,
            signal: request.signal,
          });
          const result = (await response.json().catch(() => null)) as {
            text?: string;
            error?: { message?: string };
          } | null;
          if (!response.ok || !result?.text?.trim()) {
            console.error(
              "Rita transcription failed",
              response.status,
              result?.error?.message ?? "",
            );
            return new Response("Rita could not hear that clearly. Please try again.", {
              status: 502,
            });
          }
          transcript = result.text.trim().slice(0, MAX_TEXT);
        }
        if (!transcript) return new Response("Say or type something for Rita.", { status: 400 });

        const prompt = systemPrompt({
          personality,
          language,
          accentPreference,
          accentHint,
          browserLocale,
          words: settings.responseWords,
        });
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: RITA_MODELS.response,
            response_format: { type: "json_object" },
            max_tokens: 260,
            messages: [
              { role: "system", content: prompt },
              ...history,
              { role: "user", content: transcript },
            ],
          }),
          signal: request.signal,
        });
        const raw = (await response.json().catch(() => null)) as any;
        const content = String(raw?.choices?.[0]?.message?.content ?? "");
        if (!response.ok || !content) {
          console.error("Rita response failed", response.status, raw?.error?.message ?? "");
          return new Response("Rita could not answer right now. Please try again.", {
            status: 502,
          });
        }

        let result: TutorResult;
        try {
          result = extractJson(content);
        } catch (error) {
          console.error("Rita returned invalid tutor JSON", error);
          return new Response("Rita could not prepare that answer. Please try again.", {
            status: 502,
          });
        }
        if (!result.reply) return new Response("Rita’s answer was empty.", { status: 502 });

        const turnId = crypto.randomUUID();
        const outputAudioMs = estimateSpeechDurationMs(result.reply);
        const inputTokens = Number(raw?.usage?.prompt_tokens ?? 0);
        const outputTokens = Number(raw?.usage?.completion_tokens ?? 0);
        const estimatedCostMicros = estimateTurnCostMicros({
          inputAudioMs,
          outputAudioMs: premiumVoice ? outputAudioMs : 0,
          inputTokens,
          outputTokens,
        });
        const replySha256 = await sha256(result.reply);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin.from as any)("rita_voice_usage").insert({
            user_id: auth.userId,
            session_id: /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : null,
            turn_id: turnId,
            input_audio_ms: inputAudioMs,
            output_audio_ms: premiumVoice ? outputAudioMs : 0,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            estimated_cost_micros: estimatedCostMicros,
            language: result.detectedLanguage,
            dialect: result.detectedDialect,
            reply_sha256: replySha256,
            premium_voice: premiumVoice,
          });
          if (/^[0-9a-f-]{36}$/i.test(sessionId)) {
            await (supabaseAdmin.from as any)("rita_voice_sessions")
              .update({
                last_active_at: new Date().toISOString(),
                detected_language: result.detectedLanguage,
                detected_dialect: result.detectedDialect,
              })
              .eq("id", sessionId)
              .eq("user_id", auth.userId);
          }
        } catch (error) {
          console.warn("Rita usage logging is not ready", error);
        }

        return Response.json(
          {
            turnId,
            transcript,
            ...result,
            premiumVoice,
            allowance,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

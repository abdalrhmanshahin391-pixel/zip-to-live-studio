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
import type { LearningItem } from "@/lib/rita-learning";
import { explicitRitaAccent, stableRitaDialect } from "@/lib/rita-voice-style";

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
  learningItems: LearningItem[];
  saveRequest: "none" | "flashcards" | "german_lab";
  destinationName: string;
  rememberDestination: boolean;
};

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "rita_lesson_turn",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "reply",
        "detectedLanguage",
        "detectedDialect",
        "confidence",
        "correction",
        "emotion",
        "lessonAction",
        "learningItems",
        "saveRequest",
        "destinationName",
        "rememberDestination",
      ],
      properties: {
        reply: { type: "string" },
        detectedLanguage: { type: "string" },
        detectedDialect: { type: "string" },
        confidence: { type: "number" },
        correction: { type: "string" },
        emotion: {
          type: "string",
          enum: ["neutral", "warm", "encouraging", "playful", "thoughtful", "excited"],
        },
        lessonAction: { type: "string" },
        learningItems: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["term", "meaning", "language", "kind", "article", "plural"],
            properties: {
              term: { type: "string" },
              meaning: { type: "string" },
              language: { type: "string" },
              kind: { type: "string", enum: ["word", "sentence"] },
              article: { type: ["string", "null"], enum: ["der", "die", "das", null] },
              plural: { type: ["string", "null"] },
            },
          },
        },
        saveRequest: { type: "string", enum: ["none", "flashcards", "german_lab"] },
        destinationName: { type: "string" },
        rememberDestination: { type: "boolean" },
      },
    },
  },
} as const;

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
  const learningItems: LearningItem[] = Array.isArray(parsed.learningItems)
    ? parsed.learningItems.slice(0, 3).flatMap((raw) => {
        const term = String(raw?.term ?? "")
          .trim()
          .slice(0, 180);
        const meaning = String(raw?.meaning ?? "")
          .trim()
          .slice(0, 280);
        const language = String(raw?.language ?? "")
          .trim()
          .slice(0, 30);
        if (!term || !meaning || !/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language)) return [];
        const article = ["der", "die", "das"].includes(String(raw?.article))
          ? (raw.article as LearningItem["article"])
          : null;
        const validArticle =
          language.toLowerCase().split("-")[0] === "de" && raw?.kind !== "sentence"
            ? article
            : null;
        const cleanTerm = validArticle
          ? term.replace(new RegExp(`^${validArticle}\\s+`, "i"), "").trim()
          : term;
        if (!cleanTerm) return [];
        return [
          {
            term: cleanTerm,
            meaning,
            language,
            kind: raw?.kind === "sentence" ? ("sentence" as const) : ("word" as const),
            article: validArticle,
            plural: raw?.plural ? String(raw.plural).trim().slice(0, 120) : null,
          },
        ];
      })
    : [];
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
    learningItems,
    saveRequest:
      parsed.saveRequest === "flashcards" || parsed.saveRequest === "german_lab"
        ? parsed.saveRequest
        : "none",
    destinationName: String(parsed.destinationName ?? "")
      .trim()
      .slice(0, 100),
    rememberDestination: parsed.rememberDestination === true,
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
  pendingSaveTarget: string;
  words: number;
}) {
  return `You are Rita, a natural one-to-one language tutor speaking aloud. Style: ${PERSONALITY_INSTRUCTIONS[args.personality]}
Language choice: ${args.language}. In automatic mode, follow the learner's latest clear language, unless they explicitly ask you to speak another language. Keep that requested language until they change it. Do not switch languages from one borrowed word or a weak guess.
Requested dialect/accent: ${args.accentPreference || "none"}; this overrides every guess. Previous stable dialect: ${args.accentHint || "unknown"}. Browser locale ${args.browserLocale || "unknown"} is only a weak hint. If the learner asks for Jordanian Arabic, say شو/بدي naturally, not Iraqi شنو. For any other region, use its natural everyday dialect without caricature. A text transcript cannot prove an acoustic accent; when uncertain, keep the prior dialect if its language still fits, otherwise speak naturally and neutrally.
Answer the learner's actual question first in under ${args.words} spoken words unless they ask for detail. Correct only useful errors, briefly. Avoid repeated praise, scripted openings, or a compulsory question. Never claim you cannot speak: the site manages audio. Never shame or mock the learner.
Quietly return up to three words or sentences genuinely taught or translated in this exchange; otherwise learningItems is []. Spell terms correctly, keep German noun articles separate, and do not invent unknown plurals. For an explicit save request, set saveRequest and ask which subject if none was named. Pending save question: ${args.pendingSaveTarget}; a short subject name can answer it. Set rememberDestination only if requested. Never claim a save is complete; the site confirms it.
Return only the JSON object required by the response schema. detectedLanguage describes the language of your spoken reply, as a BCP-47 code; detectedDialect is its BCP-47 region or concise label. confidence reflects dialect evidence, not confidence in your answer.`;
}

export const Route = createFileRoute("/api/rita/turn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const turnStartedAt = performance.now();
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
        const pendingSaveTarget = ["flashcards", "german_lab"].includes(
          String(form.get("pendingSaveTarget")),
        )
          ? String(form.get("pendingSaveTarget"))
          : "none";
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
        let transcriptionDurationMs = 0;

        if (hasAudio) {
          if (audio.size > MAX_AUDIO_BYTES)
            return new Response("That voice turn is too long.", { status: 413 });
          inputAudioMs = estimateWavDurationMs(audio);
          const transcription = new FormData();
          transcription.append("model", RITA_MODELS.transcription);
          transcription.append("file", audio, audio.name || "rita-turn.wav");
          const code = languageCode(language);
          if (code) transcription.append("language", code);
          // In automatic mode, an English transcription prompt can bias Arabic
          // or code-switched speech toward the wrong language. Let the audio
          // model detect it instead of guessing from the browser locale.
          const transcriptionStartedAt = performance.now();
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
          transcriptionDurationMs = performance.now() - transcriptionStartedAt;
        }
        if (!transcript) return new Response("Say or type something for Rita.", { status: 400 });

        const requestedAccent = explicitRitaAccent(transcript);
        const effectiveAccent = requestedAccent || accentPreference;

        const prompt = systemPrompt({
          personality,
          language,
          accentPreference: effectiveAccent,
          accentHint,
          browserLocale,
          pendingSaveTarget,
          words: settings.responseWords,
        });
        const responseStartedAt = performance.now();
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: RITA_MODELS.response,
            response_format: responseFormat,
            max_tokens: 650,
            messages: [
              { role: "system", content: prompt },
              ...history,
              { role: "user", content: transcript },
            ],
          }),
          signal: request.signal,
        });
        const raw = (await response.json().catch(() => null)) as any;
        const responseDurationMs = performance.now() - responseStartedAt;
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

        result.detectedDialect = stableRitaDialect({
          detected: result.detectedDialect,
          confidence: result.confidence,
          previous: accentHint,
          preference: effectiveAccent,
          language: result.detectedLanguage,
        });

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
        let usageSaved = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: usageError } = await (supabaseAdmin.from as any)(
            "rita_voice_usage",
          ).insert({
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
          if (usageError) throw usageError;
          usageSaved = true;
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
          console.warn("Rita usage logging failed", error);
        }

        return Response.json(
          {
            turnId,
            transcript,
            ...result,
            premiumVoice: premiumVoice && usageSaved,
            voiceError:
              premiumVoice && !usageSaved
                ? "Rita’s voice could not be prepared. Please try a new message."
                : null,
            allowance,
          },
          {
            headers: {
              "Cache-Control": "no-store",
              "Server-Timing": `transcription;dur=${transcriptionDurationMs.toFixed(1)},answer;dur=${responseDurationMs.toFixed(1)},total;dur=${(performance.now() - turnStartedAt).toFixed(1)}`,
            },
          },
        );
      },
    },
  },
});

/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  getRitaSettings,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function voiceInstructions(language: string, dialect: string, emotion: string) {
  const cleanLanguage = language.trim() || "the language of the supplied text";
  const cleanAccent = dialect.trim();
  const accent =
    cleanAccent && !/^(unknown|standard|automatic)$/i.test(cleanAccent)
      ? `Speak in authentic, contemporary ${cleanAccent}, using its natural pronunciation, rhythm, vocabulary, and conversational cadence. Keep it easy to understand and never exaggerate or stereotype the accent.`
      : `Speak naturally in ${cleanLanguage}, with a warm contemporary conversational accent. Preserve colloquial words and code switching exactly.`;
  const emotionLine =
    emotion === "excited"
      ? "Sound genuinely excited but controlled."
      : emotion === "playful"
        ? "Sound lightly playful and clever."
        : emotion === "thoughtful"
          ? "Sound thoughtful, calm, and attentive."
          : "Sound warm, patient, and encouraging.";
  return `${accent} ${emotionLine} This is a live tutoring conversation: use short natural pauses, never sound like an announcer, and do not add words that are not in the input.`;
}

export const Route = createFileRoute("/api/rita/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as {
          text?: string;
          turnId?: string;
          language?: string;
          dialect?: string;
          emotion?: string;
        } | null;
        const text = String(body?.text ?? "")
          .trim()
          .slice(0, 3_000);
        const turnId = String(body?.turnId ?? "");
        if (!text || !/^[0-9a-f-]{36}$/i.test(turnId))
          return new Response("Invalid speech request", { status: 400 });

        const settings = await getRitaSettings();
        const key = await resolveRitaOpenAiKey();
        if (!key) return new Response("Rita’s voice is not configured.", { status: 503 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: turn } = await (supabaseAdmin.from as any)("rita_voice_usage")
            .select("reply_sha256,premium_voice,speech_generated_at")
            .eq("turn_id", turnId)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (!turn?.premium_voice || turn.reply_sha256 !== (await sha256(text)))
            return new Response("Speech turn was not authorized", { status: 403 });
          if (turn.speech_generated_at)
            return new Response("Speech for this turn was already generated", { status: 409 });

          const voice = ALLOWED_VOICES.has(settings.voice) ? settings.voice : "marin";
          const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: RITA_MODELS.speech,
              voice,
              input: text,
              instructions: voiceInstructions(
                String(body?.language ?? ""),
                String(body?.dialect ?? ""),
                String(body?.emotion ?? "warm"),
              ),
              response_format: "opus",
              speed: 1.02,
            }),
            signal: request.signal,
          });
          if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text().catch(() => "");
            console.error("Rita speech failed", upstream.status, detail.slice(0, 240));
            return new Response("Rita’s premium voice is unavailable.", { status: 502 });
          }
          await (supabaseAdmin.from as any)("rita_voice_usage")
            .update({ speech_generated_at: new Date().toISOString() })
            .eq("turn_id", turnId)
            .eq("user_id", auth.userId);
          return new Response(upstream.body, {
            headers: {
              "Content-Type": "audio/ogg; codecs=opus",
              "Cache-Control": "private, no-store",
              "X-Rita-Voice": "premium",
            },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita speech request failed", error);
          return new Response("Rita’s premium voice is unavailable.", { status: 502 });
        }
      },
    },
  },
});

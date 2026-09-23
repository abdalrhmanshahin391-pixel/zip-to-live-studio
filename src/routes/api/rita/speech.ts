/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  getRitaSettings,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";
import { ritaVoiceInstructions } from "@/lib/rita-voice-style";

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

function speechError(
  code: string,
  message: string,
  status: number,
  traceId = "",
  retryable = true,
) {
  return Response.json(
    { code, error: message, retryable, traceId },
    { status, headers: traceId ? { "X-Rita-Trace": traceId } : undefined },
  );
}

export const Route = createFileRoute("/api/rita/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        const auth = await requireRitaUser(request);
        if (!auth) return speechError("unauthorized", "Please sign in again.", 401, traceId, false);
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
          return speechError(
            "invalid_request",
            "Rita received an invalid voice request.",
            400,
            traceId,
            false,
          );

        const [settings, key] = await Promise.all([getRitaSettings(), resolveRitaOpenAiKey()]);
        if (!key)
          return speechError(
            "not_configured",
            "Rita’s voice is not configured.",
            503,
            traceId,
            false,
          );

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const claimStartedAt = performance.now();
          const claimAt = new Date().toISOString();
          const replyHash = await sha256(text);
          const { data: claimed, error: claimError } = await (supabaseAdmin.from as any)(
            "rita_voice_usage",
          )
            .update({ speech_generated_at: claimAt })
            .eq("turn_id", turnId)
            .eq("user_id", auth.userId)
            .eq("reply_sha256", replyHash)
            .eq("premium_voice", true)
            .is("speech_generated_at", null)
            .select("turn_id")
            .maybeSingle();
          const claimDurationMs = performance.now() - claimStartedAt;
          if (claimError) {
            console.error("Rita speech claim failed", traceId, claimError);
            return speechError(
              "usage_unavailable",
              "Rita’s voice record is unavailable.",
              503,
              traceId,
            );
          }
          if (!claimed)
            return speechError(
              "turn_unavailable",
              "This voice is unavailable or was already generated. Please use Replay instead.",
              409,
              traceId,
              false,
            );

          const releaseClaim = async () => {
            const { error } = await (supabaseAdmin.from as any)("rita_voice_usage")
              .update({ speech_generated_at: null })
              .eq("turn_id", turnId)
              .eq("user_id", auth.userId)
              .eq("speech_generated_at", claimAt);
            if (error) console.warn("Rita speech claim release failed", traceId, error);
          };

          const voice = ALLOWED_VOICES.has(settings.voice) ? settings.voice : "marin";
          const speechStartedAt = performance.now();
          const responseFormat = "pcm";
          const contentType = "audio/pcm;rate=24000";
          try {
            const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: RITA_MODELS.speech,
                voice,
                input: text,
                instructions: ritaVoiceInstructions(
                  String(body?.language ?? ""),
                  String(body?.dialect ?? ""),
                  String(body?.emotion ?? "warm"),
                ),
                response_format: responseFormat,
                stream_format: "audio",
                speed: 1,
              }),
              signal: request.signal,
            });
            const speechDurationMs = performance.now() - speechStartedAt;
            if (!upstream.ok || !upstream.body) {
              const detail = await upstream.text().catch(() => "");
              console.error("Rita speech failed", traceId, upstream.status, detail.slice(0, 240));
              await releaseClaim();
              return speechError(
                "provider_unavailable",
                "Rita’s voice service could not generate audio.",
                502,
                traceId,
              );
            }
            // Economic v2 always passes raw 24 kHz PCM through exactly once.
            // This avoids Safari MediaSource/MP3 body locking and lets playback
            // begin as soon as the first OpenAI audio bytes arrive.
            return new Response(upstream.body, {
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, no-store",
                "X-Rita-Voice": "premium",
                "X-Rita-Trace": traceId,
                "Server-Timing": `claim;dur=${claimDurationMs.toFixed(1)},speech;dur=${speechDurationMs.toFixed(1)}`,
              },
            });
          } catch (error) {
            await releaseClaim();
            throw error;
          }
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita speech request failed", traceId, error);
          return speechError("speech_failed", "Rita’s voice could not be prepared.", 502, traceId);
        }
      },
    },
  },
});

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

function speechError(code: string, message: string, status: number) {
  return Response.json({ code, error: message }, { status });
}

export const Route = createFileRoute("/api/rita/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return speechError("unauthorized", "Please sign in again.", 401);
        const body = (await request.json().catch(() => null)) as {
          text?: string;
          turnId?: string;
          language?: string;
          dialect?: string;
          emotion?: string;
          streamAudio?: boolean;
        } | null;
        const text = String(body?.text ?? "")
          .trim()
          .slice(0, 3_000);
        const turnId = String(body?.turnId ?? "");
        if (!text || !/^[0-9a-f-]{36}$/i.test(turnId))
          return speechError("invalid_request", "Rita received an invalid voice request.", 400);

        const [settings, key] = await Promise.all([getRitaSettings(), resolveRitaOpenAiKey()]);
        if (!key) return speechError("not_configured", "Rita’s voice is not configured.", 503);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: turn, error: turnError } = await (supabaseAdmin.from as any)(
            "rita_voice_usage",
          )
            .select("reply_sha256,premium_voice,speech_generated_at")
            .eq("turn_id", turnId)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (turnError) {
            console.error("Rita speech usage lookup failed", turnError);
            return speechError("usage_unavailable", "Rita’s voice record is unavailable.", 503);
          }
          if (!turn?.premium_voice || turn.reply_sha256 !== (await sha256(text)))
            return speechError(
              "turn_unavailable",
              "Rita could not prepare voice for this reply.",
              403,
            );
          if (turn.speech_generated_at)
            return speechError(
              "already_generated",
              "This voice was already generated. Please use Replay instead.",
              409,
            );

          const voice = ALLOWED_VOICES.has(settings.voice) ? settings.voice : "marin";
          const speechStartedAt = performance.now();
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
              response_format: "mp3",
              stream_format: "audio",
              speed: 1,
            }),
            signal: request.signal,
          });
          if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text().catch(() => "");
            console.error("Rita speech failed", upstream.status, detail.slice(0, 240));
            return speechError(
              "provider_unavailable",
              "Rita’s voice service could not generate audio.",
              502,
            );
          }
          if (body?.streamAudio) {
            const firstReader = upstream.body.getReader();
            let firstChunk = await firstReader.read();
            while (!firstChunk.done && !firstChunk.value?.byteLength)
              firstChunk = await firstReader.read();
            if (firstChunk.done || !firstChunk.value) {
              await firstReader.cancel().catch(() => undefined);
              return speechError("empty_audio", "Rita’s voice service returned no audio.", 502);
            }
            const { data: claimed, error: claimError } = await (supabaseAdmin.from as any)(
              "rita_voice_usage",
            )
              .update({ speech_generated_at: new Date().toISOString() })
              .eq("turn_id", turnId)
              .eq("user_id", auth.userId)
              .is("speech_generated_at", null)
              .select("turn_id")
              .maybeSingle();
            if (claimError || !claimed) {
              await firstReader.cancel().catch(() => undefined);
              if (claimError)
                return speechError("usage_unavailable", "Rita’s voice record is unavailable.", 503);
              return speechError(
                "already_generated",
                "This voice was already generated. Please use Replay instead.",
                409,
              );
            }
            let cancelled = false;
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(firstChunk.value);
                void (async () => {
                  try {
                    while (true) {
                      const next = await firstReader.read();
                      if (next.done) break;
                      if (next.value?.byteLength) controller.enqueue(next.value);
                    }
                    if (!cancelled) controller.close();
                  } catch (error) {
                    if (!cancelled) controller.error(error);
                  } finally {
                    firstReader.releaseLock();
                  }
                })();
              },
              cancel() {
                cancelled = true;
                void firstReader.cancel().catch(() => undefined);
              },
            });
            return new Response(stream, {
              headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "private, no-store",
                "X-Rita-Voice": "premium",
                "Server-Timing": `speech-first-byte;dur=${(performance.now() - speechStartedAt).toFixed(1)}`,
              },
            });
          }
          const bytes = await upstream.arrayBuffer();
          if (!bytes.byteLength)
            return speechError("empty_audio", "Rita’s voice service returned no audio.", 502);
          const { error: updateError } = await (supabaseAdmin.from as any)("rita_voice_usage")
            .update({ speech_generated_at: new Date().toISOString() })
            .eq("turn_id", turnId)
            .eq("user_id", auth.userId);
          if (updateError) console.error("Rita speech usage update failed", updateError);
          return new Response(bytes, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "private, no-store",
              "X-Rita-Voice": "premium",
            },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita speech request failed", error);
          return speechError("speech_failed", "Rita’s voice could not be prepared.", 502);
        }
      },
    },
  },
});

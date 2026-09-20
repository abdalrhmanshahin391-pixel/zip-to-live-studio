/* eslint-disable @typescript-eslint/no-explicit-any -- Rita usage table awaits generated types. */
import { createFileRoute } from "@tanstack/react-router";
import { getRitaPilotMode, requireRitaUser, RITA_REALTIME_MODEL } from "@/lib/rita-voice.server";

const positive = (value: unknown) => Math.min(100_000, Math.max(0, Math.floor(Number(value) || 0)));

export const Route = createFileRoute("/api/rita/usage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        if ((await getRitaPilotMode(auth.userId)) !== "realtime")
          return new Response("Pilot off", { status: 403 });
        const payload = await request.json().catch(() => null);
        const sessionId = String(payload?.sessionId ?? "");
        const responseId = String(payload?.responseId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^resp_[a-zA-Z0-9_-]{5,100}$/.test(responseId))
          return new Response("Invalid usage report", { status: 400 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const table = (name: string) => (supabaseAdmin.from as any)(name);
          const { data: session } = await table("rita_voice_sessions")
            .select("id,started_at")
            .eq("id", sessionId)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (!session || Date.now() - new Date(session.started_at).getTime() > 10 * 60_000)
            return new Response("Expired session", { status: 403 });
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(responseId),
          );
          const replyHash = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          const { data: existing, error: lookupError } = await table("rita_voice_usage")
            .select("id")
            .eq("user_id", auth.userId)
            .eq("session_id", sessionId)
            .eq("reply_sha256", replyHash)
            .maybeSingle();
          if (lookupError) return new Response("Usage service unavailable", { status: 503 });
          if (existing) return Response.json({ ok: true });
          const input = positive(payload?.inputTokens);
          const output = positive(payload?.outputTokens);
          const inputAudio = Math.min(input, positive(payload?.inputAudioTokens));
          const outputAudio = Math.min(output, positive(payload?.outputAudioTokens));
          const cached = Math.min(input, positive(payload?.cachedInputTokens));
          const cachedAudio = Math.min(inputAudio, positive(payload?.cachedAudioTokens), cached);
          // Published per-million-token rates for gpt-realtime-2.1-mini.
          const micros = Math.round(
            (inputAudio - cachedAudio) * 10 +
              cachedAudio * 0.3 +
              (input - inputAudio - (cached - cachedAudio)) * 0.6 +
              (cached - cachedAudio) * 0.06 +
              outputAudio * 20 +
              (output - outputAudio) * 2.4,
          );
          const { error } = await table("rita_voice_usage").insert({
            user_id: auth.userId,
            session_id: sessionId,
            input_tokens: input,
            output_tokens: output,
            input_audio_ms: 0,
            output_audio_ms: 0,
            estimated_cost_micros: Math.max(0, micros),
            response_model: RITA_REALTIME_MODEL,
            speech_model: RITA_REALTIME_MODEL,
            transcription_model: "gpt-4o-mini-transcribe",
            reply_sha256: replyHash,
            status: "pilot_realtime",
            speech_generated_at: new Date().toISOString(),
          });
          if (error) return new Response("Could not record usage", { status: 503 });
          return Response.json({ ok: true });
        } catch {
          return new Response("Usage service unavailable", { status: 503 });
        }
      },
    },
  },
});

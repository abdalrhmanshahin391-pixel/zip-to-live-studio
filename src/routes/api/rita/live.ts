/* eslint-disable @typescript-eslint/no-explicit-any -- Pilot tables are pending generated database types. */
import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaPilotMode,
  getRitaSettings,
  RITA_REALTIME_MODEL,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

const MAX_SDP = 64_000;
const PILOT_CONNECTION_MS = 5 * 60_000;
const MAX_DAILY_CONNECTIONS = 4;
const REALTIME_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

export const Route = createFileRoute("/api/rita/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return Response.json({ error: "Sign in first." }, { status: 401 });
        if ((await getRitaPilotMode(auth.userId)) !== "realtime")
          return Response.json(
            { error: "Realtime pilot is off for this account." },
            { status: 403 },
          );
        const settings = await getRitaSettings();
        if (!settings.enabled)
          return Response.json({ error: "Rita voice is disabled." }, { status: 403 });
        const sessionId = request.headers.get("X-Rita-Session") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(sessionId))
          return Response.json({ error: "Start a Rita lesson first." }, { status: 400 });
        if (request.headers.get("content-type") !== "application/sdp")
          return Response.json({ error: "Expected a WebRTC offer." }, { status: 415 });
        const sdp = await request.text();
        if (sdp.length < 100 || sdp.length > MAX_SDP || !sdp.startsWith("v=0"))
          return Response.json({ error: "Invalid WebRTC offer." }, { status: 400 });
        const key = await resolveRitaOpenAiKey();
        if (!key)
          return Response.json({ error: "Add an OpenAI key in Admin first." }, { status: 503 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const table = (name: string) => (supabaseAdmin.from as any)(name);
          const { data: lesson, error: lessonError } = await table("rita_voice_sessions")
            .select("id,started_at,ended_at")
            .eq("id", sessionId)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (
            lessonError ||
            !lesson ||
            lesson.ended_at ||
            Date.now() - new Date(lesson.started_at).getTime() > 60_000
          )
            return Response.json({ error: "Start a fresh Rita lesson." }, { status: 403 });

          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const { data: rows, error: countError } = await table("rita_voice_sessions")
            .select("id,started_at,ended_at")
            .eq("user_id", auth.userId)
            .like("client_label", "rita-realtime:%")
            .neq("client_label", "rita-realtime:failed")
            .gte("started_at", today.toISOString());
          if (countError || !Array.isArray(rows))
            return Response.json({ error: "Realtime cost guard is unavailable." }, { status: 503 });
          if (
            rows.length >= MAX_DAILY_CONNECTIONS ||
            rows.some(
              (row: any) =>
                !row.ended_at &&
                Date.now() - new Date(row.started_at).getTime() < PILOT_CONNECTION_MS,
            )
          )
            return Response.json(
              { error: "Pilot limit reached: four five-minute calls per day, one at a time." },
              { status: 429 },
            );
          const { data: reservation, error: reserveError } = await table("rita_voice_sessions")
            .update({ client_label: "rita-realtime:pending" })
            .eq("id", sessionId)
            .eq("user_id", auth.userId)
            .select("id")
            .single();
          if (reserveError || !reservation)
            return Response.json({ error: "Could not reserve a pilot call." }, { status: 503 });

          const fd = new FormData();
          fd.set("sdp", sdp);
          fd.set(
            "session",
            JSON.stringify({
              type: "realtime",
              model: RITA_REALTIME_MODEL,
              output_modalities: ["audio"],
              max_output_tokens: 420,
              instructions: `You are Rita, a warm, quick language tutor in a live spoken conversation. Reply naturally and briefly (usually under 55 words). Follow the learner's explicit language or dialect request and keep it until they change it. Otherwise mirror the latest clear language without switching for a borrowed word or weak cue. Match a clear spoken dialect naturally without caricature. Jordanian Arabic uses شو and بدي, never Iraqi شنو. Correct useful mistakes gently; ask at most one relevant follow-up. Never say you cannot speak or are text-only. If asked to save words, help choose a subject; never claim anything was saved.`,
              audio: {
                input: {
                  transcription: { model: "gpt-4o-mini-transcribe" },
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 550,
                    create_response: true,
                    interrupt_response: true,
                  },
                },
                output: { voice: REALTIME_VOICES.has(settings.voice) ? settings.voice : "marin" },
              },
            }),
          );
          let provider: Response;
          try {
            provider = await fetch("https://api.openai.com/v1/realtime/calls", {
              method: "POST",
              headers: { Authorization: `Bearer ${key}` },
              body: fd,
              signal: AbortSignal.timeout(20_000),
            });
          } catch {
            await table("rita_voice_sessions")
              .update({ client_label: "rita-realtime:failed" })
              .eq("id", reservation.id);
            return Response.json(
              { error: "Could not connect to OpenAI. Check your network or key." },
              { status: 502 },
            );
          }
          if (!provider.ok) {
            const rejected = (await provider.json().catch(() => null)) as {
              error?: { code?: unknown; param?: unknown; type?: unknown };
            } | null;
            const safeField = (value: unknown) =>
              typeof value === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : null;
            const code = safeField(rejected?.error?.code);
            const param = safeField(rejected?.error?.param);
            const type = safeField(rejected?.error?.type);
            await table("rita_voice_sessions")
              .update({ client_label: "rita-realtime:failed" })
              .eq("id", reservation.id);
            console.warn("Rita Realtime connection rejected", {
              status: provider.status,
              code,
              param,
              type,
              requestId: provider.headers.get("x-request-id"),
            });
            const reason =
              param && provider.status === 400
                ? `OpenAI rejected the Realtime setting “${param}”.`
                : code === "model_not_found" || provider.status === 403
                  ? "The OpenAI project cannot use this Realtime model."
                  : `OpenAI rejected the Realtime connection (${provider.status}${code ? ` · ${code}` : ""}).`;
            return Response.json(
              { error: reason, providerStatus: provider.status, code, param },
              { status: 502 },
            );
          }
          const answer = await provider.text();
          await table("rita_voice_sessions")
            .update({ client_label: "rita-realtime:connected" })
            .eq("id", reservation.id);
          return new Response(answer, {
            headers: {
              "Content-Type": "application/sdp",
              "Cache-Control": "no-store",
              "X-Rita-Model": RITA_REALTIME_MODEL,
              "X-Rita-Pilot-Limit-Seconds": "300",
            },
          });
        } catch (error) {
          console.error("Rita pilot setup failed", error);
          return Response.json(
            { error: "Realtime pilot could not start. Please try again." },
            { status: 503 },
          );
        }
      },
    },
  },
});

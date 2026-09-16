import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_SDP_LENGTH = 150_000;
const PERSONALITIES = ["kind", "direct", "playful", "strict"] as const;

function instructions(personality: string, language: string) {
  const tone = {
    kind: "warm, patient and encouraging",
    direct: "clear, concise and honest about mistakes",
    playful: "lightly playful and upbeat, without insulting the learner",
    strict: "calm, structured and demanding, while always respectful",
  }[personality as (typeof PERSONALITIES)[number]] ?? "warm and encouraging";

  return `You are Rita, a live language tutor in RitaJet. Speak naturally and briefly, like a real excellent teacher. Your tone is ${tone}. Detect the learner's spoken language and dialect from the conversation, then use the language they are most comfortable with unless they ask you to switch. Help them practise, correct errors clearly, ask one useful follow-up at a time, and celebrate genuine progress. Never mock, humiliate, harass, or shame a learner. Their selected language is ${language || "automatic detection"}.`;
}

export const Route = createFileRoute("/api/rita/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token || token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"];
        const anonKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !anonKey) return new Response("Backend not configured", { status: 503 });
        const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: claims, error } = await supabase.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        const apiKey = (process.env["OPENAI_API_KEY"] ?? "").trim();
        if (!apiKey) {
          return new Response("Rita Live is not configured yet. Ask the site owner to add OPENAI_API_KEY.", { status: 503 });
        }

        let body: { sdp?: string; personality?: string; language?: string };
        try { body = await request.json(); } catch { return new Response("Invalid session request", { status: 400 }); }
        const sdp = String(body.sdp ?? "");
        if (!sdp || sdp.length > MAX_SDP_LENGTH) return new Response("Invalid WebRTC offer", { status: 400 });

        const session = {
          type: "realtime",
          model: "gpt-realtime",
          instructions: instructions(String(body.personality ?? "kind"), String(body.language ?? "automatic")),
          audio: {
            input: { turn_detection: { type: "server_vad", silence_duration_ms: 700 } },
            output: { voice: "coral" },
          },
        };
        const form = new FormData();
        form.append("sdp", sdp);
        form.append("session", new Blob([JSON.stringify(session)], { type: "application/json" }));

        try {
          const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: request.signal,
          });
          const answer = await upstream.text();
          if (!upstream.ok) {
            console.error("Rita Live connection failed", upstream.status, answer.slice(0, 300));
            return new Response("Rita could not start a live session. Please try again.", { status: upstream.status });
          }
          return new Response(answer, { status: 200, headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
        } catch (cause) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita Live connection error", cause);
          return new Response("Rita could not connect right now.", { status: 502 });
        }
      },
    },
  },
});

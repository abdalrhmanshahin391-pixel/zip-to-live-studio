import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_SDP_LENGTH = 150_000;
const PERSONALITIES = ["kind", "direct", "playful", "strict"] as const;

function buildInstructions(personality: string, language: string) {
  const tone =
    {
      kind: "warm, patient and encouraging",
      direct: "clear, concise and honest about mistakes",
      playful: "lightly playful and upbeat, without insulting the learner",
      strict: "calm, structured and demanding, while always respectful",
    }[personality as (typeof PERSONALITIES)[number]] ?? "warm and encouraging";

  return `You are Rita, a live language tutor in RitaJet. Speak naturally and briefly, like an excellent human teacher. Your tone is ${tone}. Detect the learner's spoken language and dialect, then use the language they are most comfortable with unless they ask you to switch. Help them practise, correct errors clearly, ask one useful follow-up at a time, and celebrate genuine progress. Keep spoken answers concise. Never mock, humiliate, harass, or shame a learner. Their selected language is ${language || "automatic detection"}.`;
}

async function requireUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return false;

  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const anon =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !anon) return false;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  return !error && Boolean(data?.claims?.sub);
}

async function resolveOpenAiKey() {
  const secret = (process.env["OPENAI_API_KEY"] ?? "").trim();
  if (secret.length > 20) return secret;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_ai_keys")
      .select("api_key")
      .eq("provider", "openai")
      .eq("purpose", "shared")
      .eq("slot", 1)
      .maybeSingle();
    const saved = String(data?.api_key ?? "").trim();
    return saved.length > 20 ? saved : null;
  } catch (error) {
    console.warn("Could not read Rita Live key", error);
    return null;
  }
}

export const Route = createFileRoute("/api/rita/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await requireUser(request))) return new Response("Unauthorized", { status: 401 });
        return Response.json(
          { mode: (await resolveOpenAiKey()) ? "live" : "demo" },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        if (!(await requireUser(request))) return new Response("Unauthorized", { status: 401 });

        const apiKey = await resolveOpenAiKey();
        if (!apiKey) {
          return new Response(
            "Rita Live is not configured yet. The free demo is still available.",
            { status: 503 },
          );
        }

        let body: { sdp?: string; personality?: string; language?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid session request", { status: 400 });
        }
        const sdp = String(body.sdp ?? "");
        if (!sdp || sdp.length > MAX_SDP_LENGTH)
          return new Response("Invalid WebRTC offer", { status: 400 });

        try {
          const upstream = await fetch("https://api.openai.com/v1/live/sessions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session: {
                model: "gpt-live-1",
                instructions: buildInstructions(
                  String(body.personality ?? "kind"),
                  String(body.language ?? "automatic detection"),
                ),
                audio: { output: { voice: "marin" } },
              },
              transport: { type: "webrtc", sdp },
            }),
            signal: request.signal,
          });
          const result = (await upstream.json().catch(() => null)) as {
            transport?: { sdp?: string };
            error?: { message?: string };
            message?: string;
          } | null;
          if (!upstream.ok || !result?.transport?.sdp) {
            const detail = String(result?.error?.message ?? result?.message ?? "");
            console.error("Rita Live connection failed", upstream.status, detail.slice(0, 300));
            return new Response(
              "Rita could not start a live session. Check the OpenAI key and billing, then try again.",
              {
                status: upstream.status || 502,
              },
            );
          }
          return new Response(String(result.transport.sdp), {
            status: 200,
            headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" },
          });
        } catch (cause) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita Live connection error", cause);
          return new Response("Rita could not connect right now.", { status: 502 });
        }
      },
    },
  },
});

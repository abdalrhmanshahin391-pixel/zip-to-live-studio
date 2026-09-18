import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 2_000;
type TranscriptionResult = { text?: unknown; error?: { message?: unknown } };
type ChatResult = {
  choices?: { message?: { content?: unknown } }[];
  error?: { message?: unknown };
};

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

function systemPrompt(personality: string, language: string) {
  const tones: Record<string, string> = {
    kind: "warm, patient and encouraging",
    direct: "direct, concise and honest about mistakes",
    playful: "witty, cheerful and playful without insulting the learner",
    strict: "structured, demanding and always respectful",
  };
  return `You are Rita, RitaJet's conversational language teacher. Be ${tones[personality] ?? tones.kind}. Reply in the learner's language and dialect unless they ask to switch; their preference is ${language || "automatic"}. Correct useful mistakes briefly, then continue the conversation with one natural question. Keep the answer easy to say aloud and normally under 80 words. Never shame, humiliate, harass, or mock a learner. Return only Rita's reply.`;
}

export const Route = createFileRoute("/api/rita/demo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await requireUser(request))) return new Response("Unauthorized", { status: 401 });
        const key = (process.env["LOVABLE_API_KEY"] ?? "").trim();
        if (!key) return new Response("The demo voice service is not configured.", { status: 503 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        const personality = String(form.get("personality") ?? "kind").slice(0, 30);
        const language = String(form.get("language") ?? "automatic").slice(0, 80);
        let transcript = String(form.get("text") ?? "")
          .trim()
          .slice(0, MAX_TEXT);
        const audio = form.get("audio");

        if (audio instanceof File && audio.size > 0) {
          if (audio.size > MAX_AUDIO_BYTES)
            return new Response("Recording too long", { status: 413 });
          const upstream = new FormData();
          upstream.append("model", "openai/gpt-4o-transcribe");
          upstream.append("file", audio, audio.name || "rita-recording.webm");
          if (/^(Arabic|English|German|Turkish)$/i.test(language)) {
            const map: Record<string, string> = {
              arabic: "ar",
              english: "en",
              german: "de",
              turkish: "tr",
            };
            upstream.append("language", map[language.toLowerCase()]);
          }
          try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
              method: "POST",
              headers: { Authorization: `Bearer ${key}` },
              body: upstream,
              signal: request.signal,
            });
            const result = (await response.json().catch(() => null)) as TranscriptionResult | null;
            if (!response.ok) {
              console.error(
                "Rita demo transcription failed",
                response.status,
                result?.error?.message ?? "",
              );
              return new Response("Rita could not hear that clearly. Please try again.", {
                status: 502,
              });
            }
            transcript = String(result?.text ?? "")
              .trim()
              .slice(0, MAX_TEXT);
          } catch (error) {
            if (request.signal.aborted) return new Response(null, { status: 499 });
            console.error("Rita demo transcription error", error);
            return new Response("Rita could not hear that clearly. Please try again.", {
              status: 502,
            });
          }
        }

        if (!transcript)
          return new Response("Say or type something for Rita first.", { status: 400 });

        let history: { role: "user" | "assistant"; content: string }[] = [];
        try {
          const parsed = JSON.parse(String(form.get("history") ?? "[]"));
          if (Array.isArray(parsed)) {
            history = parsed
              .slice(-10)
              .filter((item) => item?.role === "user" || item?.role === "assistant")
              .map((item) => ({
                role: item.role,
                content: String(item.content ?? "").slice(0, 1_000),
              }));
          }
        } catch {
          history = [];
        }

        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              temperature: 0.65,
              max_tokens: 220,
              messages: [
                { role: "system", content: systemPrompt(personality, language) },
                ...history,
                { role: "user", content: transcript },
              ],
            }),
            signal: request.signal,
          });
          const result = (await response.json().catch(() => null)) as ChatResult | null;
          const reply = String(result?.choices?.[0]?.message?.content ?? "").trim();
          if (!response.ok || !reply) {
            console.error("Rita demo reply failed", response.status, result?.error?.message ?? "");
            return new Response("Rita could not answer right now. Please try again.", {
              status: 502,
            });
          }
          return Response.json(
            { transcript, reply: reply.slice(0, 3_000) },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita demo reply error", error);
          return new Response("Rita could not answer right now. Please try again.", {
            status: 502,
          });
        }
      },
    },
  },
});

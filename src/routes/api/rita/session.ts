/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createFileRoute } from "@tanstack/react-router";
import {
  cleanLanguage,
  getRitaAllowance,
  getRitaPilotMode,
  getRitaSettings,
  normalizePersonality,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

export const Route = createFileRoute("/api/rita/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const settings = await getRitaSettings();
        const allowance = await getRitaAllowance(auth.userId, settings);
        const pilotMode = await getRitaPilotMode(auth.userId);
        return Response.json(
          {
            configured: Boolean(await resolveRitaOpenAiKey()),
            enabled: settings.enabled,
            voice: settings.voice,
            pilotMode,
            allowance,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const action = String(body.action ?? "start");
        const settings = await getRitaSettings();
        const allowance = await getRitaAllowance(auth.userId, settings);

        if (action === "end") {
          const sessionId = String(body.sessionId ?? "");
          if (/^[0-9a-f-]{36}$/i.test(sessionId)) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await (supabaseAdmin.from as any)("rita_voice_sessions")
                .update({
                  ended_at: new Date().toISOString(),
                  last_active_at: new Date().toISOString(),
                })
                .eq("id", sessionId)
                .eq("user_id", auth.userId);
            } catch (error) {
              console.warn("Could not close Rita session", error);
            }
          }
          return Response.json({ ok: true });
        }

        if (!allowance.allowed) {
          const message =
            allowance.reason === "daily_guard"
              ? "Rita voice has reached today’s fair-use safety limit. Please continue by text or return tomorrow."
              : "Rita voice is temporarily unavailable.";
          return Response.json({ ok: false, allowance, message }, { status: 429 });
        }

        const personality = normalizePersonality(body.personality);
        const languagePreference = cleanLanguage(body.language);
        const clientLabel = String(body.clientLabel ?? "browser").slice(0, 120);
        const pilotMode = await getRitaPilotMode(auth.userId);
        let sessionId: string = crypto.randomUUID();
        let persisted = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await (supabaseAdmin.from as any)("rita_voice_sessions")
            .insert({
              user_id: auth.userId,
              personality,
              language_preference: languagePreference,
              client_label: clientLabel,
            })
            .select("id")
            .single();
          if (!error && data?.id) {
            sessionId = String(data.id);
            persisted = true;
          }
        } catch (error) {
          console.warn("Rita session logging is not ready", error);
        }
        if (pilotMode === "realtime" && !persisted)
          return Response.json(
            { ok: false, message: "Realtime pilot storage is not ready." },
            { status: 503 },
          );
        return Response.json(
          {
            ok: true,
            sessionId,
            configured: Boolean(await resolveRitaOpenAiKey()),
            pilotMode,
            allowance,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

export const testRitaLiveKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SupabaseClient; userId: string };
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const environmentKey = (process.env["OPENAI_API_KEY"] ?? "").trim();
    let key = environmentKey;
    if (!key) {
      const { data: row, error } = await supabase
        .from("admin_ai_keys")
        .select("api_key")
        .eq("provider", "openai")
        .eq("purpose", "shared")
        .eq("slot", 1)
        .maybeSingle();
      if (error) throw error;
      key = String(row?.api_key ?? "").trim();
    }
    if (!key) return { ok: false, message: "No OpenAI key is saved yet." };

    try {
      const response = await fetch("https://api.openai.com/v1/models/gpt-live-1", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.ok) {
        return {
          ok: true,
          message: environmentKey
            ? "Working — Rita Live is using the protected environment key."
            : "Working — Rita Live can reach gpt-live-1 with this saved key.",
        };
      }
      const result = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const detail = String(result?.error?.message ?? `OpenAI returned ${response.status}`).slice(
        0,
        180,
      );
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          message: "OpenAI rejected this key. Check the key and project permissions.",
        };
      }
      return { ok: false, message: detail };
    } catch (error) {
      return {
        ok: false,
        message: `Could not reach OpenAI: ${String((error as Error)?.message ?? error).slice(0, 140)}`,
      };
    }
  });

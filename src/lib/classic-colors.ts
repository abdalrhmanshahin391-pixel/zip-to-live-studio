import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { updateSiteSettings } from "@/lib/site-settings.functions";

/**
 * Site-wide "classic colours" switch. When it is on, the home and pricing
 * pages fall back to the original cream surface and green action buttons.
 * It is stored in site settings, so flipping it affects every visitor.
 */
export function useClassicColors() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data } = useQuery({
    queryKey: ["classic-colors"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("site_settings")
        .select("classic_colors")
        .eq("id", true)
        .maybeSingle();
      if (error) return false;
      return !!data?.classic_colors;
    },
    staleTime: 60_000,
  });
  const classic = !!data;

  async function setClassic(next: boolean) {
    setSaving(true);
    try {
      await updateSiteSettings({ data: { classic_colors: next } });
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["classic-colors"] });
    } catch (err) {
      console.error(err);
      alert("Could not change the colours.");
    } finally {
      setSaving(false);
    }
  }

  return { classic, setClassic, saving };
}

/** Class name to put on a page wrapper so the classic palette applies. */
export function classicClass(classic: boolean) {
  return classic ? "rita-classic" : "";
}

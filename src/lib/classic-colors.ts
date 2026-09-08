import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/site-settings.functions";

/**
 * Site-wide "classic colours" switch. When it is on, the home and pricing
 * pages fall back to the original cream surface and green action buttons.
 * It is stored in site settings, so flipping it affects every visitor.
 */
export function useClassicColors() {
  const settings = useSiteSettings();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const classic = settings.classic_colors;

  async function setClassic(next: boolean) {
    setSaving(true);
    try {
      await updateSiteSettings({ data: { classic_colors: next } });
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
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

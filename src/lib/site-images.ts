import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/legacy-client";
import { signSiteMedia, uploadSiteMedia } from "@/lib/site-media";

export type SiteImageMap = Record<string, string>;

/** All admin-set picture overrides, resolved to usable URLs. */
export function useSiteImages() {
  return useQuery<SiteImageMap>({
    queryKey: ["site-images"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("site_images").select("key,path");
      const rows = (data ?? []) as { key: string; path: string }[];
      const entries = await Promise.all(
        rows.map(async (r) => [r.key, (await signSiteMedia(r.path)) ?? ""] as const),
      );
      return Object.fromEntries(entries.filter(([, url]) => url)) as SiteImageMap;
    },
  });
}

/** Returns the override for `key` when one exists, otherwise the built-in art. */
export function useSiteImage(key: string, fallback: string) {
  const { data } = useSiteImages();
  return data?.[key] || fallback;
}

export function useSiteImageActions() {
  const qc = useQueryClient();

  async function replace(key: string, file: File) {
    const path = await uploadSiteMedia(file);
    const { error } = await (supabase.from as any)("site_images").upsert(
      { key, path },
      { onConflict: "key" },
    );
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["site-images"] });
  }

  async function reset(key: string) {
    const { error } = await (supabase.from as any)("site_images").delete().eq("key", key);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["site-images"] });
  }

  return { replace, reset };
}

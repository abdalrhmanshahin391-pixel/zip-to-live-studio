import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

export type PlanRow = {
  slug: string;
  name: string;
  tagline: string;
  price_cents: number;
  yearly_cents: number;
  max_flashcards: number | null;
  max_ai_questions: number | null;
  max_summaries: number | null;
  max_todo_tasks: number | null;
  max_calendar_items: number | null;
  max_groups: number | null;
  max_all_in_one_lectures: number | null;
  max_all_in_one_questions: number | null;
  max_archive_questions: number | null;
  max_rita_questions: number | null;
  todo_full: boolean;
  rich_cards: boolean;
  feature_lecture_qgen: boolean;
  feature_archive_qgen: boolean;
  feature_all_in_one: boolean;
  feature_rita38: boolean;
  sort: number;
  billing_kind?: "monthly" | "lifetime";
  once_cents?: number;
  paddle_price_monthly?: string | null;
  paddle_price_yearly?: string | null;
  paddle_price_once?: string | null;
};

export type PlanUsage = {
  plan: PlanRow;
  usage: {
    summaries: number;
    ai_questions: number;
    flashcards: number;
    todo_tasks: number;
    calendar_items: number;
    all_in_one_lectures: number;
    all_in_one_questions: number;
    archive_questions: number;
    rita_questions: number;
    groups: number;
  };
  /** Extra allowance bought as one-time packs, on top of the plan caps. */
  grants?: Partial<Record<keyof PlanUsage["usage"], number>>;
  /** Set while a claimed special offer is still running. */
  offer_name?: string | null;
  offer_expires_at?: string | null;
  is_admin: boolean;
};



/** Public plan catalogue for the pricing page. */
export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env["VITE_SUPABASE_URL"]!,
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await (client.from as any)("plans").select("*").order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
});

/** The signed-in student's plan plus what they have used this month. */
export const myPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await ((context as any).supabase as any).rpc("my_plan_usage");
    if (error) throw new Error(error.message);
    return data as PlanUsage;
  });

/** Counts locally created flashcards against the plan limit. */
export const recordFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ count: z.number().int().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const { assertQuota, bumpQuota } = await import("@/lib/quota.server");
    await assertQuota(userId, "flashcards", data.count);
    await bumpQuota(userId, "flashcards", data.count);
    return { ok: true };
  });

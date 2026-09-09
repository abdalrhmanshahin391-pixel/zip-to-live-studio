import { supabase } from "@/integrations/supabase/legacy-client";
import { fetchAuthors, type DeckAuthor } from "@/lib/share-decks";

const db = (t: string) => (supabase.from as any)(t);

/** Who a shared question set is for: one classroom/group, or everyone on RitaJet. */
export type SetAudience = "space" | "public";

export type SharedQuestionSet = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover: string;
  emoji: string | null;
  tags: string[];
  question_count: number;
  save_count: number;
  published: boolean;
  audience: SetAudience;
  created_at: string;
};

export type SharedQuestionItem = {
  id: string;
  set_id: string;
  stem: string;
  options: any;
  explanation: string;
  sort: number;
};

export const PAGE_SIZE = 24;
/** Questions load in pages so a set with thousands of items stays fast. */
export const QUESTION_PAGE = 25;

export type { DeckAuthor };

/** One page of the public question-set feed. */
export async function fetchQuestionFeed(opts: {
  search?: string;
  sort?: "new" | "top";
  page?: number;
}) {
  const page = Math.max(0, opts.page ?? 0);
  let q = db("shared_question_sets")
    .select("*")
    .eq("published", true)
    .eq("audience", "public");

  if (opts.search?.trim()) q = q.ilike("title", `%${opts.search.trim()}%`);
  q =
    opts.sort === "top"
      ? q.order("save_count", { ascending: false })
      : q.order("created_at", { ascending: false });

  const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  const sets = (data ?? []) as SharedQuestionSet[];
  const authors = await fetchAuthors(sets.map((s) => s.owner_id));
  return { sets, authors, hasMore: sets.length === PAGE_SIZE, page };
}

export async function fetchMyQuestionSets(userId: string) {
  const { data, error } = await db("shared_question_sets")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .range(0, 199);
  if (error) throw error;
  return (data ?? []) as SharedQuestionSet[];
}

export async function fetchQuestionSet(id: string) {
  const { data, error } = await db("shared_question_sets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const set = data as SharedQuestionSet;
  const authors = await fetchAuthors([set.owner_id]);
  return { set, author: authors[set.owner_id] ?? null };
}

/** One page of questions inside a set. */
export async function fetchQuestionPage(setId: string, page: number) {
  const from = page * QUESTION_PAGE;
  const { data, error } = await db("shared_question_items")
    .select("*")
    .eq("set_id", setId)
    .order("sort", { ascending: true })
    .range(from, from + QUESTION_PAGE - 1);
  if (error) throw error;
  return (data ?? []) as SharedQuestionItem[];
}

/**
 * Publishes a snapshot of Lecture Lab questions as a shared set.
 *
 * With `spaceId` the set belongs to that classroom or study group only and is
 * never listed publicly. Large sets are written in chunks so thousands of
 * questions can be shared in one go.
 */
export async function publishQuestionSet(input: {
  title: string;
  description: string;
  cover: string;
  emoji: string | null;
  tags: string[];
  questions: { stem: string; options: any; explanation: string }[];
  spaceId?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (input.questions.length === 0) throw new Error("Pick at least one lecture that has questions");

  const toSpace = !!input.spaceId;
  const { data: set, error } = await db("shared_question_sets")
    .insert({
      owner_id: uid,
      title: input.title.trim(),
      description: input.description.trim() || null,
      cover: input.cover,
      emoji: input.emoji,
      tags: toSpace ? [] : input.tags,
      question_count: input.questions.length,
      audience: toSpace ? "space" : "public",
      published: !toSpace,
    })
    .select("id")
    .single();
  if (error) throw error;

  const rows = input.questions.map((q, i) => ({
    set_id: set.id,
    owner_id: uid,
    stem: q.stem,
    options: q.options ?? [],
    explanation: q.explanation ?? "",
    sort: i,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insErr } = await db("shared_question_items").insert(rows.slice(i, i + 500));
    if (insErr) throw insErr;
  }

  if (input.spaceId) {
    const { error: spErr } = await db("space_question_sets").insert({
      space_id: input.spaceId,
      set_id: set.id,
      added_by: uid,
    });
    if (spErr) throw spErr;
  }
  return set.id as string;
}

export async function setQuestionSetPublished(setId: string, published: boolean) {
  const { data, error } = await db("shared_question_sets")
    .update({ published })
    .eq("id", setId)
    .select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this set can change it.");
}

export async function deleteQuestionSet(setId: string) {
  const { data, error } = await db("shared_question_sets").delete().eq("id", setId).select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this set can delete it.");
}

/** Question sets that were added into one classroom or study group. */
export async function fetchSpaceQuestionSets(spaceId: string) {
  const { data, error } = await db("space_question_sets")
    .select("set_id, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .range(0, 199);
  if (error) throw error;
  const ids = ((data ?? []) as { set_id: string }[]).map((r) => r.set_id);
  if (ids.length === 0) return [] as SharedQuestionSet[];
  const { data: sets } = await db("shared_question_sets").select("*").in("id", ids);
  return (sets ?? []) as SharedQuestionSet[];
}

export async function removeQuestionSetFromSpace(spaceId: string, setId: string) {
  const { error } = await db("space_question_sets")
    .delete()
    .eq("space_id", spaceId)
    .eq("set_id", setId);
  if (error) throw error;
}

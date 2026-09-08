import { supabase } from "@/integrations/supabase/legacy-client";

const db = (t: string) => (supabase.from as any)(t);

/** Who a shared deck is for: one classroom/group, or everyone on RitaJet. */
export type DeckAudience = "space" | "public";

export type SharedDeck = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover: string;
  emoji: string | null;
  tags: string[];
  card_count: number;
  save_count: number;
  published: boolean;
  audience: DeckAudience;
  created_at: string;
};


export type SharedDeckCard = {
  id: string;
  deck_id: string;
  group_name: string | null;
  front: string;
  back: string;
  sort: number;
};

export type DeckAuthor = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export const DECK_COVERS: Record<string, { from: string; to: string; ink: string }> = {
  apricot: { from: "#f6c67a", to: "#f0a95c", ink: "#7a4b16" },
  sky: { from: "#a6d3f2", to: "#6aa9d8", ink: "#1f4c6d" },
  lilac: { from: "#cbb8ef", to: "#9b83d1", ink: "#4a3877" },
  mint: { from: "#a6e0c1", to: "#6ab887", ink: "#215237" },
  coral: { from: "#f6b4a2", to: "#d1795e", ink: "#7d3421" },
  lime: { from: "#c9e88a", to: "#8ec63f", ink: "#3d5c14" },
};

export function coverOf(key: string) {
  return DECK_COVERS[key] ?? DECK_COVERS["apricot"]!;
}

/** Public feed of shared decks, newest or most saved first. Classroom-only decks never appear here. */
export async function fetchFeed(opts: { search?: string; sort?: "new" | "top"; tag?: string }) {
  let q = db("shared_decks").select("*").eq("published", true).eq("audience", "public");

  if (opts.search?.trim()) q = q.ilike("title", `%${opts.search.trim()}%`);
  if (opts.tag) q = q.contains("tags", [opts.tag]);
  q = opts.sort === "top"
    ? q.order("save_count", { ascending: false })
    : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(60);
  if (error) throw error;
  const decks = (data ?? []) as SharedDeck[];
  const authors = await fetchAuthors(decks.map((d) => d.owner_id));
  return { decks, authors };
}

export async function fetchAuthors(ids: string[]): Promise<Record<string, DeckAuthor>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const { data } = await db("public_profiles")
    .select("id,username,full_name,avatar_url,bio")
    .in("id", unique);
  const out: Record<string, DeckAuthor> = {};
  for (const row of (data ?? []) as DeckAuthor[]) out[row.id] = row;
  return out;
}

export async function fetchDeck(id: string) {
  const { data, error } = await db("shared_decks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const deck = data as SharedDeck;
  const [{ data: cards }, authors] = await Promise.all([
    db("shared_deck_cards").select("*").eq("deck_id", id).order("sort", { ascending: true }),
    fetchAuthors([deck.owner_id]),
  ]);
  return {
    deck,
    cards: (cards ?? []) as SharedDeckCard[],
    author: authors[deck.owner_id] ?? null,
  };
}

export async function fetchMyDecks(userId: string) {
  const { data, error } = await db("shared_decks")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SharedDeck[];
}

/**
 * Saves a snapshot of the picked topics' cards as a shared deck.
 *
 * With `spaceId` the deck belongs to that classroom or study group only: it is
 * never listed publicly and is added straight into the space. Without it the
 * deck is shared with everyone on RitaJet.
 */
export async function publishDeck(input: {
  title: string;
  description: string;
  cover: string;
  emoji: string | null;
  tags: string[];
  groups: { name: string; cards: { front: string; back: string }[] }[];
  spaceId?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  const groups = input.groups.filter((g) => g.cards.length > 0);
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  if (total === 0) throw new Error("Pick at least one topic that has cards");

  const toSpace = !!input.spaceId;
  const { data: deck, error } = await db("shared_decks")
    .insert({
      owner_id: uid,
      title: input.title.trim(),
      description: input.description.trim() || null,
      cover: input.cover,
      emoji: input.emoji,
      tags: toSpace ? [] : input.tags,
      card_count: total,
      audience: toSpace ? "space" : "public",
      published: !toSpace,
    })
    .select("id")
    .single();
  if (error) throw error;

  let sort = 0;
  const payload = groups.flatMap((g) =>
    g.cards.map((c) => ({
      deck_id: deck.id,
      owner_id: uid,
      group_name: g.name,
      front: c.front,
      back: c.back,
      sort: sort++,
    })),
  );
  const { error: insErr } = await db("shared_deck_cards").insert(payload);
  if (insErr) throw insErr;

  if (input.spaceId) {
    const { addDeckToSpace } = await import("@/lib/spaces");
    await addDeckToSpace(input.spaceId, deck.id as string, null);
  }
  return deck.id as string;
}

export async function setPublished(deckId: string, published: boolean) {
  const { data, error } = await db("shared_decks")
    .update({ published })
    .eq("id", deckId)
    .select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this deck can change it.");
}

/** Takes a deck off the public page while keeping it inside its classrooms. */
export async function setAudience(deckId: string, audience: DeckAudience) {
  const { data, error } = await db("shared_decks")
    .update({ audience, published: audience === "public" })
    .eq("id", deckId)
    .select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this deck can change it.");
}


export async function deleteDeck(deckId: string) {
  const { data, error } = await db("shared_decks").delete().eq("id", deckId).select("id");
  if (error) throw error;
  if (!(data ?? []).length) throw new Error("Only the student who shared this deck can delete it.");
}

export async function isSaved(deckId: string, userId: string) {
  const { data } = await db("shared_deck_saves")
    .select("deck_id")
    .eq("deck_id", deckId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Copies a shared deck into the signed-in user's own flashcard board. */
export async function saveDeckToMySubjects(deckId: string, deckTitle: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  const { data: cards, error } = await db("shared_deck_cards")
    .select("front,back,sort,group_name")
    .eq("deck_id", deckId)
    .order("sort", { ascending: true });
  if (error) throw error;
  const rows = (cards ?? []) as { front: string; back: string; group_name: string | null }[];
  if (rows.length === 0) throw new Error("This deck is empty");

  const groups: { name: string; cards: { front: string; back: string }[] }[] = [];
  for (const r of rows) {
    const name = r.group_name || "Shared cards";
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, cards: [] }));
    g.cards.push({ front: r.front, back: r.back });
  }

  const { addDeckToBoard } = await import("@/lib/local-board");
  const subject = addDeckToBoard(deckTitle, groups);

  await db("shared_deck_saves").upsert({ deck_id: deckId, user_id: uid });
  await (supabase as any).rpc("bump_deck_saves", { _deck_id: deckId });

  return subject;
}


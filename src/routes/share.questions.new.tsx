import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  ListChecks,
  Loader2,
  Send,
  Sparkles,
  BookOpen,
  Archive,
  GraduationCap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { getDailyShareQuota } from "@/lib/share-decks";
import {
  DECK_COVERS,
  coverOf,
  publishQuestionSet,
  fetchUserQuestionSources,
  fetchQuestionsForPublish,
  type QuestionSourceType,
  SOURCE_TYPE_META,
  type QuestionSubjectNode,
} from "@/lib/share-questions";
import { listMySpaces } from "@/lib/spaces";

const EMOJIS = ["❓", "🩺", "🧬", "💊", "🫀", "🧠", "🔬", "🦴", "🧪", "📚", "🎯", "⚡"];

export const Route = createFileRoute("/share/questions/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    space: typeof s.space === "string" ? s.space : undefined,
    source: (typeof s.source === "string" && ["bank", "archive", "lecture"].includes(s.source)
      ? s.source
      : "lecture") as QuestionSourceType,
  }),
  component: NewQuestionSetPage,
});

export function NewQuestionSetPage() {
  const { space: spaceIdParam, source: initialSource } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [sourceType, setSourceType] = useState<QuestionSourceType>(initialSource || "lecture");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(spaceIdParam || null);
  const [destination, setDestination] = useState<"public" | "space">(spaceIdParam ? "space" : "public");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagText, setTagText] = useState("");
  const [cover, setCover] = useState("sky");
  const [emoji, setEmoji] = useState("❓");
  const [saving, setSaving] = useState(false);

  // Selected item IDs (e.g. lecture IDs, subject IDs, or archive `${subj}:::${subtop}` IDs)
  const [pickedItemIds, setPickedItemIds] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Load question trees for current user
  const sourcesQuery = useQuery({
    queryKey: ["user-question-sources", user?.id],
    queryFn: () => fetchUserQuestionSources(user!.id),
    enabled: !!user,
  });

  // Load spaces user belongs to
  const spacesQuery = useQuery({
    queryKey: ["user-my-spaces", user?.id],
    queryFn: () => listMySpaces(user!.id),
    enabled: !!user,
  });

  // Daily sharing quota query
  const quotaQuery = useQuery({
    queryKey: ["daily-share-quota", user?.id],
    queryFn: () => getDailyShareQuota(user!.id),
    enabled: !!user,
  });
  const quota = quotaQuery.data;

  const currentNodes: QuestionSubjectNode[] = useMemo(() => {
    if (!sourcesQuery.data) return [];
    return sourcesQuery.data[sourceType] || [];
  }, [sourcesQuery.data, sourceType]);

  // When source changes, reset selections
  const handleSourceChange = (st: QuestionSourceType) => {
    setSourceType(st);
    setPickedItemIds(new Set());
    setExpandedSubjects(new Set());
  };

  const c = coverOf(cover);
  const toSpace = destination === "space";

  // Calculate total questions selected
  const totalSelectedQuestions = useMemo(() => {
    let count = 0;
    for (const node of currentNodes) {
      for (const item of node.items) {
        if (pickedItemIds.has(item.id)) {
          count += item.questionCount;
        }
      }
    }
    return count;
  }, [currentNodes, pickedItemIds]);

  // Toggle all items in a subject
  const toggleSubject = (node: QuestionSubjectNode) => {
    const next = new Set(pickedItemIds);
    const itemIds = node.items.map((it) => it.id);
    const allSelected = itemIds.length > 0 && itemIds.every((id) => next.has(id));

    if (allSelected) {
      itemIds.forEach((id) => next.delete(id));
    } else {
      itemIds.forEach((id) => next.add(id));
    }
    setPickedItemIds(next);
  };

  // Toggle single item
  const toggleItem = (itemId: string) => {
    const next = new Set(pickedItemIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setPickedItemIds(next);
  };

  // Select all subjects
  const selectAllSubjects = () => {
    const next = new Set<string>();
    for (const node of currentNodes) {
      for (const it of node.items) {
        next.add(it.id);
      }
    }
    setPickedItemIds(next);
  };

  // Clear all selections
  const deselectAll = () => {
    setPickedItemIds(new Set());
  };

  // Toggle expand subject
  const toggleExpand = (nodeId: string) => {
    const next = new Set(expandedSubjects);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedSubjects(next);
  };

  async function publish() {
    if (!user) {
      toast.error("Please sign in to share questions");
      return;
    }
    if (quota?.isBlocked) {
      toast.error("Daily sharing quota reached (5/5). Delete an item uploaded today to unlock a slot.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please provide a title for the question set");
      return;
    }
    if (pickedItemIds.size === 0) {
      toast.error("Please select at least one subject or lecture that contains questions");
      return;
    }
    if (toSpace && !selectedSpaceId) {
      toast.error("Please select a classroom or study group to share with");
      return;
    }

    setSaving(true);
    try {
      const selectedArray = Array.from(pickedItemIds);
      const questions = await fetchQuestionsForPublish(sourceType, selectedArray);

      if (!questions || questions.length === 0) {
        throw new Error("No questions found in the selected topics.");
      }

      const tags = tagText
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      // Determine primary subject label
      const selectedNodes = currentNodes.filter((n) =>
        n.items.some((it) => pickedItemIds.has(it.id)),
      );
      const subjectLabel =
        selectedNodes.length === 1
          ? selectedNodes[0].name
          : selectedNodes.length > 1
            ? `${selectedNodes.length} Subjects`
            : null;

      const newSetId = await publishQuestionSet({
        title,
        description,
        source_type: sourceType,
        subject: subjectLabel,
        cover,
        emoji,
        tags,
        questions,
        spaceId: toSpace ? selectedSpaceId : null,
      });

      toast.success(`Published question set with ${questions.length} questions!`);

      if (toSpace && selectedSpaceId) {
        void navigate({ to: "/spaces/$spaceId", params: { spaceId: selectedSpaceId } });
      } else {
        void navigate({ to: "/share/questions/$setId", params: { setId: newSetId } });
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to share question set");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-black/30";

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <div className="mb-6">
          {spaceIdParam ? (
            <Link
              to="/spaces/$spaceId"
              params={{ spaceId: spaceIdParam }}
              className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] transition hover:text-[#23201d]"
            >
              <ArrowLeft size={15} /> Back to space
            </Link>
          ) : (
            <Link
              to="/share"
              className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] transition hover:text-[#23201d]"
            >
              <ArrowLeft size={15} /> Back to shared resources
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-sky-800">
                ❓ Question Set
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                  SOURCE_TYPE_META[sourceType].badgeClass
                }`}
              >
                {SOURCE_TYPE_META[sourceType].icon} {SOURCE_TYPE_META[sourceType].label}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${
                  quota?.isBlocked
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                Quota: {quota?.usedToday ?? 0} / 5 shared today ({quota?.remaining ?? 5} left)
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                  toSpace ? "bg-[#eef7e4] text-[#3f6a17]" : "bg-[#fdf0d8] text-[#8a6a1f]"
                }`}
              >
                {toSpace ? "🔒 Space members only" : "🌍 Everyone on RitaJet"}
              </span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-black tracking-tight md:text-4xl">
              {toSpace ? "Share questions with your space" : "Share questions with everyone"}
            </h1>
            <p className="mt-2 text-[15px] text-[#6b655c]">
              Select subjects, pick specific questions, and publish a structured set with answers and explanations.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white p-1">
            <button
              type="button"
              onClick={() => {
                setDestination("public");
                setSelectedSpaceId(null);
              }}
              className={`rounded-full px-4 py-2 text-[13px] font-black transition ${
                destination === "public" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
              }`}
            >
              🌍 Public Community
            </button>
            <button
              type="button"
              onClick={() => {
                setDestination("space");
                if (!selectedSpaceId && spacesQuery.data && spacesQuery.data.length > 0) {
                  setSelectedSpaceId(spacesQuery.data[0].id);
                }
              }}
              className={`rounded-full px-4 py-2 text-[13px] font-black transition ${
                destination === "space" ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
              }`}
            >
              🔒 Classroom / Space
            </button>
          </div>
        </div>

        {quota?.isBlocked && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs font-semibold text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Daily sharing limit reached (5/5 items shared today)</p>
              <p className="mt-1 leading-relaxed">
                You have used all 5 sharing slots for today across flashcards and questions. To share this question set right now,
                simply delete one of the items you shared today in{" "}
                <Link
                  to="/share"
                  search={{ type: "questions" }}
                  className="font-black text-red-900 underline"
                >
                  My Shared Items
                </Link>
                . Deleting an item automatically frees up your slot immediately!
              </p>
            </div>
          </div>
        )}

        {/* Cross-navigation switcher: Questions vs Flashcards */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white/70 p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-[#6b655c]">
            <span className="text-xl">🃏</span>
            <span>Looking to share Flashcard flip-decks instead?</span>
          </div>
          <Link
            to="/share/new"
            search={{ space: selectedSpaceId ?? undefined }}
            className="inline-flex items-center gap-1 text-xs font-black text-purple-700 hover:underline"
          >
            Share Flashcard Deck →
          </Link>
        </div>

        {/* 1. Source Category Selection */}
        <section className="mt-8 rounded-[24px] border border-black/[0.07] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-[#23201d]">1. Question Source</h2>
            <span className="text-[12px] font-bold text-[#8a8376]">
              Choose where to pull questions from
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleSourceChange("lecture")}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                sourceType === "lecture"
                  ? "border-[#8ec63f] bg-[#f4faec] ring-2 ring-[#8ec63f]/30"
                  : "border-black/[0.08] bg-white hover:border-black/20"
              }`}
            >
              <span className="text-2xl">🎓</span>
              <span className="mt-2 font-display text-[16px] font-black text-[#23201d]">
                Lecture Lab Quizzes
              </span>
              <span className="mt-1 text-[13px] leading-relaxed text-[#6b655c]">
                Quizzes and practice items generated for your lectures.
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSourceChange("archive")}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                sourceType === "archive"
                  ? "border-[#f59e0b] bg-[#fef8eb] ring-2 ring-[#f59e0b]/30"
                  : "border-black/[0.08] bg-white hover:border-black/20"
              }`}
            >
              <span className="text-2xl">🏛️</span>
              <span className="mt-2 font-display text-[16px] font-black text-[#23201d]">
                Archive Exam Questions
              </span>
              <span className="mt-1 text-[13px] leading-relaxed text-[#6b655c]">
                Past papers and exam questions solved by AI.
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSourceChange("bank")}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                sourceType === "bank"
                  ? "border-[#6366f1] bg-[#f2f4fe] ring-2 ring-[#6366f1]/30"
                  : "border-black/[0.08] bg-white hover:border-black/20"
              }`}
            >
              <span className="text-2xl">📚</span>
              <span className="mt-2 font-display text-[16px] font-black text-[#23201d]">
                Question Bank
              </span>
              <span className="mt-1 text-[13px] leading-relaxed text-[#6b655c]">
                Curriculum question bank categorized by subject.
              </span>
            </button>
          </div>
        </section>

        {/* 2. Main Content Grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left Column: Subject & Item Picker */}
          <section className="rounded-[26px] border border-black/[0.07] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
              <div>
                <h2 className="font-display text-lg font-black text-[#23201d]">
                  2. Select Subjects & Questions
                </h2>
                <p className="mt-0.5 text-xs text-[#6b655c]">
                  Tick subjects to include all questions, or expand to cherry-pick.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSubjects}
                  className="rounded-full border border-black/[0.1] bg-black/[0.03] px-3.5 py-1.5 text-xs font-black text-[#23201d] transition hover:bg-black/[0.07]"
                >
                  Select All Subjects
                </button>
                {pickedItemIds.size > 0 && (
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="rounded-full border border-black/[0.1] px-3.5 py-1.5 text-xs font-bold text-[#8a8376] transition hover:bg-black/[0.04]"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            {sourcesQuery.isLoading ? (
              <div className="py-16 text-center text-sm text-[#6b655c]">
                <Loader2 size={20} className="mx-auto mb-2 animate-spin text-[#8ec63f]" />
                Loading {SOURCE_TYPE_META[sourceType].label} items…
              </div>
            ) : currentNodes.length === 0 ? (
              <div className="py-16 text-center text-[#6b655c]">
                <span className="text-3xl">📭</span>
                <p className="mt-3 font-display text-base font-black">No questions found</p>
                <p className="mt-1 text-xs">
                  {sourceType === "lecture" && "You haven't generated any Lecture Lab quizzes yet."}
                  {sourceType === "archive" && "You haven't processed any archive exam questions yet."}
                  {sourceType === "bank" && "No questions found in the Question Bank."}
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {currentNodes.map((node) => {
                  const nodeItemIds = node.items.map((it) => it.id);
                  const selectedCountInNode = node.items.filter((it) =>
                    pickedItemIds.has(it.id),
                  ).length;
                  const allSelectedInNode =
                    nodeItemIds.length > 0 && selectedCountInNode === nodeItemIds.length;
                  const isExpanded = expandedSubjects.has(node.id);

                  return (
                    <div
                      key={node.id}
                      className="overflow-hidden rounded-2xl border border-black/[0.07] bg-[#fdfdfc] transition hover:border-black/15"
                    >
                      {/* Subject Header */}
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSubject(node)}
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                              allSelectedInNode
                                ? "border-[#8ec63f] bg-[#8ec63f] text-white"
                                : selectedCountInNode > 0
                                  ? "border-[#8ec63f] bg-[#8ec63f]/20 text-[#3d5c14]"
                                  : "border-black/25 bg-white"
                            }`}
                          >
                            {(allSelectedInNode || selectedCountInNode > 0) && (
                              <Check size={12} strokeWidth={3} />
                            )}
                          </button>
                          <span className="font-display text-[15px] font-black text-[#23201d]">
                            {node.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-black text-[#6b655c]">
                            {node.totalQuestions} questions
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpand(node.id)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-[#8a8376] hover:bg-black/[0.05]"
                            aria-label="Toggle subtopics"
                          >
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Subtopics / Items */}
                      {isExpanded && (
                        <div className="border-t border-black/[0.05] bg-white/70 px-4 py-2 space-y-1">
                          {node.items.map((item) => {
                            const isPicked = pickedItemIds.has(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleItem(item.id)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-black/[0.03]"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                                      isPicked
                                        ? "border-[#8ec63f] bg-[#8ec63f] text-white"
                                        : "border-black/20 bg-white"
                                    }`}
                                  >
                                    {isPicked && <Check size={10} strokeWidth={3} />}
                                  </span>
                                  <span className="text-[13.5px] font-semibold text-[#3d3832]">
                                    {item.title}
                                  </span>
                                </div>
                                <span className="text-[11.5px] font-bold text-[#8a8376]">
                                  {item.questionCount} Qs
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Metadata, Cover & Publishing */}
          <aside className="space-y-6">
            {/* Cover Preview Card */}
            <div
              className="relative flex h-36 flex-col justify-between overflow-hidden rounded-[26px] p-5 shadow-sm"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full border bg-white/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    SOURCE_TYPE_META[sourceType].badgeClass
                  }`}
                >
                  {SOURCE_TYPE_META[sourceType].icon} {SOURCE_TYPE_META[sourceType].label}
                </span>
                <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-black text-white">
                  {totalSelectedQuestions} Questions
                </span>
              </div>
              <div className="grid place-items-center">
                <span className="text-5xl drop-shadow-sm">{emoji}</span>
              </div>
              <div className="text-center font-display text-[15px] font-black truncate text-[#23201d]">
                {title || "Untitled Question Set"}
              </div>
            </div>

            {/* Set Configuration Form */}
            <div className="space-y-4 rounded-[26px] border border-black/[0.07] bg-white p-6 shadow-sm">
              <h3 className="font-display text-base font-black text-[#23201d]">
                3. Set Details
              </h3>

              {toSpace && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                    Target Space / Classroom
                  </label>
                  <select
                    value={selectedSpaceId || ""}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    className={`mt-1.5 ${inputClass}`}
                  >
                    {spacesQuery.isLoading ? (
                      <option>Loading spaces…</option>
                    ) : (spacesQuery.data?.length ?? 0) === 0 ? (
                      <option>No spaces found</option>
                    ) : (
                      spacesQuery.data?.map((sp: any) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cardiology & ECG Bank Review"
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What concepts and topics are covered?"
                  rows={2}
                  className={`mt-1.5 ${inputClass} resize-none`}
                />
              </div>

              {!toSpace && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                    Tags (comma separated)
                  </label>
                  <input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="cardio, ecg, year3, exam"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Cover Theme
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(DECK_COVERS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCover(key)}
                      aria-label={key}
                      className={`h-8 w-8 rounded-full transition ${
                        cover === key ? "ring-2 ring-[#23201d] ring-offset-2" : "hover:scale-105"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${v.from}, ${v.to})` }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#6b655c]">
                  Emoji Icon
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className={`grid h-8 w-8 place-items-center rounded-xl text-base transition ${
                        emoji === em ? "bg-[#23201d]" : "bg-black/[0.04] hover:bg-black/[0.08]"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={publish}
                  disabled={saving || totalSelectedQuestions === 0 || quota?.isBlocked}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_12px_24px_-12px_rgba(142,198,63,0.8)] transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {saving
                    ? "Publishing…"
                    : quota?.isBlocked
                      ? "Daily Limit Reached (5/5)"
                      : toSpace
                        ? `Share to Space (${totalSelectedQuestions} Qs)`
                        : `Publish Questions (${totalSelectedQuestions} Qs)`}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

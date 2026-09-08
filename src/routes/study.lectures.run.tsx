import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, Flag, Lightbulb, Timer, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { lqLoadRun, lqSaveAttempts } from "@/lib/lecture-lab.functions";

type Search = { ids: string; mode: "study" | "session" | "exam"; pool: "all" | "flagged" | "wrong"; minutes: number };

export const Route = createFileRoute("/study/lectures/run")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ids: String(s["ids"] ?? ""),
    mode: (["study", "session", "exam"] as const).includes(s["mode"] as never)
      ? (s["mode"] as Search["mode"])
      : "study",
    pool: (["all", "flagged", "wrong"] as const).includes(s["pool"] as never)
      ? (s["pool"] as Search["pool"])
      : "all",
    minutes: Number(s["minutes"] ?? 0) || 0,
  }),
  head: () => ({
    meta: [
      { title: "Lecture quiz — Lecture Lab" },
      {
        name: "description",
        content:
          "Run your lecture quiz in study, session or timed exam mode, with a short explanation under every question.",
      },
      { property: "og:title", content: "Lecture quiz — Lecture Lab" },
      { property: "og:description", content: "Short questions, short explanations, instant weak-spot retry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LectureRunPage,
});

type Option = { letter: string; body: string; is_correct: boolean };
type Question = {
  id: string;
  lecture_id: string;
  stem: string;
  options: Option[];
  explanation: string;
  point_ref: string | null;
};

const CREAM = "#fbf5e9";
const INK = "#23201d";

function LectureRunPage() {
  const { ids, mode, pool, minutes } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const load = useServerFn(lqLoadRun);
  const save = useServerFn(lqSaveAttempts);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [points, setPoints] = useState<{ title: string; points: string[] }[]>([]);
  const [busy, setBusy] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState(minutes * 60);

  const lectureIds = useMemo(() => ids.split(",").filter(Boolean), [ids]);

  useEffect(() => {
    if (!user || !lectureIds.length) return;
    setBusy(true);
    load({ data: { lectureIds, pool } })
      .then((r: any) => {
        setQuestions(r.questions ?? []);
        setPoints(
          ((r.lectures ?? []) as any[])
            .map((l) => ({ title: l.title, points: (l.key_points ?? []) as string[] }))
            .filter((l) => l.points.length),
        );
      })
      .catch(() => toast.error("Could not load that quiz."))
      .finally(() => setBusy(false));
  }, [user, lectureIds, pool, load]);

  const finish = useCallback(async () => {
    setDone(true);
    const rows = questions
      .filter((q) => answers[q.id] || flags[q.id])
      .map((q) => ({
        questionId: q.id,
        lectureId: q.lecture_id,
        correct: q.options.some((o) => o.is_correct && o.letter === answers[q.id]),
        flagged: !!flags[q.id],
      }));
    if (!rows.length) return;
    const correct = rows.filter((r) => r.correct).length;
    const score = Math.round((correct / questions.length) * 100);
    try {
      await save({
        data: {
          rows,
          score,
          ...(lectureIds.length === 1 ? { lectureId: lectureIds[0] as string } : {}),
        },
      });
    } catch {
      /* the round still counts on screen */
    }
  }, [questions, answers, flags, save, lectureIds]);

  // exam clock
  useEffect(() => {
    if (mode !== "exam" || done || busy || !questions.length) return;
    if (left <= 0) {
      void finish();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, left, done, busy, questions.length, finish]);

  const q = questions[idx];
  const score = useMemo(() => {
    const correct = questions.filter((x) => x.options.some((o) => o.is_correct && o.letter === answers[x.id])).length;
    return { correct, total: questions.length, pct: questions.length ? Math.round((correct / questions.length) * 100) : 0 };
  }, [questions, answers]);

  function pick(letter: string) {
    if (!q) return;
    if (mode === "study" && revealed[q.id]) return;
    setAnswers((a) => ({ ...a, [q.id]: letter }));
    if (mode === "study") setRevealed((r) => ({ ...r, [q.id]: true }));
  }

  function next() {
    if (idx + 1 >= questions.length) void finish();
    else setIdx(idx + 1);
  }

  function retryWeak() {
    const wrong = questions.filter((x) => !x.options.some((o) => o.is_correct && o.letter === answers[x.id]));
    if (!wrong.length) return toast.success("Nothing to retry — you got them all.");
    setQuestions(wrong);
    setAnswers({});
    setRevealed({});
    setIdx(0);
    setDone(false);
  }

  if (loading || busy) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center text-[15px] text-[#6b6357]">Loading your quiz…</main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-black">Lecture quiz</h1>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-extrabold text-white"
          >
            Sign in
          </Link>
        </main>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-[28px] font-black">Nothing in this pool yet</h1>
          <p className="mt-3 text-[15px] text-[#4a453d]">
            {pool === "all"
              ? "That lecture has no questions."
              : "Run the lecture once first — then your weak spots and flags show up here."}
          </p>
          <Link
            to="/study/lectures"
            className="mt-6 inline-flex rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-extrabold text-white"
          >
            Back to Lecture Lab
          </Link>
        </main>
      </div>
    );
  }

  if (done) {
    const missed = questions.filter((x) => !x.options.some((o) => o.is_correct && o.letter === answers[x.id]));
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-12 md:px-8">
          <div className="rounded-[26px] border border-black/[0.07] bg-white p-7 text-center">
            <div className="font-display text-[52px] font-black leading-none">{score.pct}%</div>
            <p className="mt-2 text-[15px] font-bold text-[#4a453d]">
              {score.correct} of {score.total} correct
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={retryWeak}
                className="rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-extrabold text-white"
              >
                Retry my weak spots
              </button>
              <Link
                to="/study/lectures"
                className="rounded-full border border-black/10 px-6 py-3 text-[14px] font-extrabold"
              >
                Back to Lecture Lab
              </Link>
            </div>
          </div>

          {missed.length > 0 && (
            <div className="mt-6 space-y-3">
              <h2 className="font-display text-[19px] font-black">What you missed</h2>
              {missed.map((m) => {
                const right = m.options.find((o) => o.is_correct);
                return (
                  <div key={m.id} className="rounded-2xl border border-black/[0.07] bg-white p-5">
                    <p className="text-[15px] font-extrabold leading-snug">{m.stem}</p>
                    <p className="mt-2 text-[14px] font-bold text-[#215237]">
                      {right?.letter}. {right?.body}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#4a453d]">
                      {m.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {points.length > 0 && (
            <div className="mt-6 rounded-[26px] border border-black/[0.07] bg-white p-6">
              <h2 className="font-display text-[19px] font-black">Key points</h2>
              {points.map((p) => (
                <div key={p.title} className="mt-3">
                  <div className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7a4b16]">{p.title}</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[#4a453d]">
                    {p.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  const chosen = q ? answers[q.id] : undefined;
  const show = q ? mode === "study" && !!revealed[q.id] : false;

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate({ to: "/study/lectures" })}
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6b6357]"
          >
            <ArrowLeft size={15} /> Leave quiz
          </button>
          <div className="flex items-center gap-3 text-[13px] font-extrabold">
            {mode === "exam" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5">
                <Timer size={14} />
                {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
              </span>
            )}
            <span className="rounded-full bg-white px-3 py-1.5">
              {idx + 1} / {questions.length}
            </span>
          </div>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-[#3f2c73] transition-all"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>

        {q && (
          <div className="mt-6 rounded-[26px] border border-black/[0.07] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[17px] font-extrabold leading-snug">{q.stem}</p>
              <button
                onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${
                  flags[q.id] ? "border-[#c07a1a] bg-[#fbe3c8] text-[#7a4b16]" : "border-black/10 text-[#6b6357]"
                }`}
                aria-label="Flag question"
              >
                <Flag size={15} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {q.options.map((o) => {
                const picked = chosen === o.letter;
                let cls = "border-black/[0.08] hover:bg-[#faf6ec]";
                if (show && o.is_correct) cls = "border-[#4c9a2a] bg-[#eef7e6]";
                else if (show && picked) cls = "border-[#c0492c] bg-[#fbeae5]";
                else if (picked) cls = "border-[#3f2c73] bg-[#f2edfb]";
                return (
                  <button
                    key={o.letter}
                    onClick={() => pick(o.letter)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${cls}`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[#f4eee0] text-[13px] font-black">
                      {o.letter}
                    </span>
                    <span className="flex-1 text-[15px] leading-relaxed">{o.body}</span>
                    {show && o.is_correct && <Check size={16} className="mt-1 text-[#4c9a2a]" />}
                    {show && picked && !o.is_correct && <X size={16} className="mt-1 text-[#c0492c]" />}
                  </button>
                );
              })}
            </div>

            {show && (
              <div className="mt-5 rounded-2xl bg-[#faf6ec] p-4">
                <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.14em] text-[#7a4b16]">
                  <Lightbulb size={14} /> Why
                </div>
                <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#4a453d]">{q.explanation}</p>
                {q.point_ref && (
                  <p className="mt-2 text-[12px] font-bold text-[#6b6357]">From the lecture: {q.point_ref}</p>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setIdx(Math.max(0, idx - 1))}
                disabled={idx === 0}
                className="rounded-full border border-black/10 px-5 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={next}
                className="rounded-full bg-[#23201d] px-6 py-2.5 text-[13px] font-extrabold text-white"
              >
                {idx + 1 >= questions.length ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

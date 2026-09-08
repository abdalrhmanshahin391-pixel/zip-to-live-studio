import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Clock, FileUp, Sparkles, Trash2, Type, Wand2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { usePlanGate } from "@/hooks/usePlanGate";
import { UpgradeWall } from "@/components/plan/UpgradeWall";
import {
  ritaListSubjects,
  ritaCreateJob,
  ritaCreateTextJob,
  ritaListRuns,
  ritaKickWorker,
  ritaDeleteJob,
} from "@/lib/rita-ai-38.functions";

export const Route = createFileRoute("/study/rita-ai")({
  head: () => ({
    meta: [
      { title: "Rita AI Model 3.8 — turn any PDF into a question bank" },
      {
        name: "description",
        content:
          "Upload a PDF and Rita AI Model 3.8 writes fully explained questions into your sub-subject while you get on with your day.",
      },
      { property: "og:title", content: "Rita AI Model 3.8" },
      {
        property: "og:description",
        content: "Upload once, close the page, come back to a finished question bank.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RitaAiPage,
});

type SubjectRow = { id: string; name: string; subSubjects: { id: string; name: string; section: string }[] };
type RunRow = {
  id: string;
  name: string;
  status: string;
  totalPages: number;
  chunksTotal: number;
  chunksDone: number;
  imported: number;
  subjectName: string;
  createdAt: string;
  error: string | null;
  log: { at: string; text: string; tech?: boolean }[];
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

function statusLabel(run: RunRow) {
  if (run.status === "done") {
    return `Finished — ${run.imported} question${run.imported === 1 ? "" : "s"} added`;
  }
  if (run.status === "failed") return "Stopped — nothing more could be added";
  if (run.chunksDone === 0) return "Getting started…";
  return "Working on your document…";
}

function RitaAiPage() {
  const { user, loading, isRealAdmin } = useAuth();
  const gate = usePlanGate();

  const listSubjects = useServerFn(ritaListSubjects);
  const createJob = useServerFn(ritaCreateJob);
  const createTextJob = useServerFn(ritaCreateTextJob);
  const listRuns = useServerFn(ritaListRuns);
  const kickWorker = useServerFn(ritaKickWorker);
  const deleteJob = useServerFn(ritaDeleteJob);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [subSubjectId, setSubSubjectId] = useState("");
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [sending, setSending] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subSubjects = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.subSubjects ?? [],
    [subjects, subjectId],
  );

  useEffect(() => {
    if (!user) return;
    listSubjects({ data: undefined } as any)
      .then((r: any) => setSubjects(r.subjects ?? []))
      .catch(() => setSubjects([]));
  }, [user, listSubjects]);

  // Runs live on the server, so the page just reads them — reopening the page
  // (or opening it on another device) shows exactly the same picture.
  useEffect(() => {
    if (!user) return;
    let alive = true;

    const tick = async () => {
      try {
        const r: any = await listRuns({ data: undefined } as any);
        if (!alive) return;
        setRuns(r.runs ?? []);
        const active = (r.runs ?? []).some((x: RunRow) => x.status === "queued" || x.status === "running");
        timer.current = setTimeout(tick, active ? 6000 : 20000);
      } catch {
        if (alive) timer.current = setTimeout(tick, 20000);
      }
    };
    tick();

    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, listRuns]);

  async function refreshSoon() {
    try {
      const r: any = await listRuns({ data: undefined } as any);
      setRuns(r.runs ?? []);
    } catch { /* ignore */ }
  }

  async function handleRun() {
    if (!subSubjectId) {
      toast.error("Pick a subject and a sub-subject first.");
      return;
    }
    if (mode === "pdf" && !file) {
      toast.error("Choose a PDF.");
      return;
    }
    if (mode === "text" && pastedText.trim().length < 40) {
      toast.error("Paste a bit more text.");
      return;
    }
    setSending(true);
    try {
      if (mode === "text") {
        await createTextJob({ data: { subjectId: subSubjectId, text: pastedText.trim(), name: "Pasted notes" } });
        setPastedText("");
      } else {
        if (file!.size > 11 * 1024 * 1024) throw new Error("That PDF is too big — keep it under 11 MB.");
        const b64 = await fileToBase64(file!);
        await createJob({ data: { subjectId: subSubjectId, pdfName: file!.name, pdfBase64: b64 } });
        setFile(null);
      }
      toast.success("Rita has it — you can close this page now.");
      await refreshSoon();
      kickWorker({ data: undefined } as any).then(refreshSoon).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Could not start that run.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteJob({ data: { jobId: id } });
    setRuns((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <UpgradeWall block={gate.block} onClose={gate.closeBlock} />
      <div className="rita38-shell">
        <main className="mx-auto max-w-5xl px-5 py-10">
          <Link
            to="/study"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back to Start learning
          </Link>

          <header className="mt-6">
            <span className="rita38-pill">
              <Sparkles size={14} /> Elite engine
            </span>
            <h1 className="rita38-title">Rita AI Model 3.8</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Give Rita a PDF and pick where the questions should live. She writes every question out in
              full — the concept, why the right answer is right, why the others are wrong and a summary —
              straight into your sub-subject. It runs on our side, so you can close this page.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: <FileUp size={13} />, t: "Upload once" },
                { icon: <Clock size={13} />, t: "Usually ~30 minutes" },
                { icon: <Wand2 size={13} />, t: "Added for you automatically" },
              ].map((c) => (
                <span key={c.t} className="rita38-chip">{c.icon} {c.t}</span>
              ))}
            </div>
          </header>

          {loading ? (
            <div className="mt-10 h-40 animate-pulse rounded-3xl border border-border bg-card" />
          ) : !user ? (
            <div className="mt-10 rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm font-bold text-foreground">Sign in to use Rita AI 3.8</p>
              <Link to="/login" className="mt-3 inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
                Sign in
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rita38-card space-y-6">
                <Step n={1} title="Your subject">
                  <select
                    value={subjectId}
                    onChange={(e) => { setSubjectId(e.target.value); setSubSubjectId(""); }}
                    className="rita38-input"
                  >
                    <option value="">Choose a subject…</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {subjects.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No subjects yet — open the Archive and add a subject (or your own section
                      inside one), then come back here.
                    </p>
                  )}
                </Step>

                <Step n={2} title="Sub-subject">
                  <select
                    value={subSubjectId}
                    onChange={(e) => setSubSubjectId(e.target.value)}
                    disabled={!subjectId}
                    className="rita38-input"
                  >
                    <option value="">Choose a sub-subject…</option>
                    {subSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.section} · {s.name}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Every question from this run goes into this sub-subject only.
                  </p>
                </Step>

                <Step n={3} title="Material">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("pdf")}
                      className={mode === "pdf" ? "rita38-tab rita38-tab--on" : "rita38-tab"}
                    >
                      <FileUp size={14} /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("text")}
                      className={mode === "text" ? "rita38-tab rita38-tab--on" : "rita38-tab"}
                    >
                      <Type size={14} /> Text
                    </button>
                  </div>
                  {mode === "pdf" ? (
                    <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center">
                      <FileUp size={22} className="text-muted-foreground" />
                      <span className="mt-2 text-sm font-bold text-foreground">
                        {file ? file.name : "Choose a PDF"}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">Up to 11 MB</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          if (!f) return;
                          if (!gate.check({ feature: "feature_rita38", kind: "rita_questions" })) return;
                          setFile(f);
                        }}
                      />
                    </label>
                  ) : (
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={7}
                      placeholder="Paste the questions here…"
                      className="rita38-input mt-3 font-mono text-xs"
                    />
                  )}
                </Step>

                <button type="button" onClick={handleRun} disabled={sending} className="rita38-run">
                  {sending ? "Handing it to Rita…" : "Run Rita AI 3.8"}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Rita usually needs about half an hour, sometimes longer for a big document. You can close
                  this page — the questions appear in your sub-subject by themselves.
                </p>
              </section>

              <section className="rita38-card">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Your runs</h2>
                  <span className="rita38-count">{runs.filter((r) => r.status !== "done").length} active</span>
                </div>

                <div className="mt-4 max-h-[30rem] space-y-3 overflow-auto pr-1">
                  {runs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing yet. Once you start a run it stays here — even if you close the page or come
                      back tomorrow.
                    </p>
                  ) : (
                    runs.map((run) => {
                      const pct = run.chunksTotal ? Math.round((run.chunksDone / run.chunksTotal) * 100) : 0;
                      const open = openRun === run.id;
                      return (
                        <div key={run.id} className="rounded-2xl border border-border bg-muted/30 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-foreground">{run.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {run.subjectName ? `${run.subjectName} · ` : ""}{statusLabel(run)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDelete(run.id)}
                              aria-label="Remove this run"
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${run.status === "done" ? 100 : pct}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs font-bold text-muted-foreground">
                            {run.imported} question{run.imported === 1 ? "" : "s"} added
                            {run.chunksTotal ? ` · ${run.chunksDone}/${run.chunksTotal} parts done` : ""}
                          </p>

                          <button
                            type="button"
                            onClick={() => setOpenRun(open ? null : run.id)}
                            className="mt-2 text-xs font-bold text-primary"
                          >
                            {open ? "Hide details" : "Show details"}
                          </button>

                          {open && (
                            <div className="mt-2 space-y-1.5">
                              {isRealAdmin && run.error && (
                                <p className="rita38-log text-destructive">{run.error}</p>
                              )}
                              {run.log.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nothing to show yet.</p>
                              ) : (
                                run.log.map((l, i) => (
                                  <p key={i} className="rita38-log">{l.text}</p>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rita38-step">{n}</span>
        <h3 className="text-sm font-black tracking-tight text-foreground">{title}</h3>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

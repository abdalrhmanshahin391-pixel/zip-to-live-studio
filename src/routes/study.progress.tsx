import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Target, Layers, TrendingDown } from "lucide-react";
import { studyDashboard, type Dashboard } from "@/lib/review.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/study/progress")({
  head: () => ({
    meta: [
      { title: "My progress — RitaJet study workspace" },
      {
        name: "description",
        content:
          "See what you have mastered, which subjects are weakest and how much you have studied over the last month.",
      },
      { property: "og:title", content: "My progress — RitaJet study workspace" },
      {
        property: "og:description",
        content: "Mastery, accuracy per subject and study minutes, all in one calm dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: tone, color: "#3a352e" }}
      >
        {icon}
      </span>
      <p className="mt-3 font-display text-[2rem] font-black leading-none text-[#23201d]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#6d6355]">{label}</p>
    </div>
  );
}

function ProgressPage() {
  const { user } = useAuth();
  const dashboard = useServerFn(studyDashboard);
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["study-dashboard", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: () => dashboard(),
  });

  const maxCards = Math.max(1, ...(data?.daily ?? []).map((d) => d.cards));
  const weakest = (data?.subjects ?? []).filter((s) => s.reviews >= 5).slice().sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#fbf5e9] px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-[70rem]">
        <Link
          to="/study"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#6d6355] hover:text-[#23201d]"
        >
          <ArrowLeft size={16} /> back to my subjects
        </Link>

        <h1 className="mt-4 font-display text-[2.4rem] font-black leading-tight tracking-tight text-[#23201d]">
          My progress
        </h1>
        <p className="mt-1 text-[15px] font-semibold text-[#6d6355]">
          Everything below comes from your own reviews — no guessing.
        </p>

        {!user && (
          <p className="mt-8 rounded-2xl bg-white p-6 text-sm font-bold text-[#6d6355]">
            Sign in to see your progress.
          </p>
        )}

        {user && isLoading && (
          <p className="mt-8 text-sm font-bold text-[#6d6355]">Adding up your reviews…</p>
        )}

        {user && data && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat
                icon={<Layers size={17} />}
                label="cards mastered"
                value={String(data.totals.mastered)}
                tone="#d8ecdd"
              />
              <Stat
                icon={<Target size={17} />}
                label="still learning"
                value={String(data.totals.learning)}
                tone="#d6e8f6"
              />
              <Stat
                icon={<Layers size={17} />}
                label="not started"
                value={String(data.totals.new)}
                tone="#e4dcf3"
              />
            </div>

            {/* True retention + what's coming */}
            <div className="mt-6 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="rounded-[26px] border border-black/[0.06] bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a79c8c]">
                  true recall
                </p>
                <p className="mt-2 font-display text-[3rem] font-black leading-none text-[#23201d]">
                  {data.retention.total >= 5 ? `${data.retention.percent}%` : "—"}
                </p>
                <p className="mt-2 text-sm font-semibold text-[#6d6355]">
                  {data.retention.total >= 5
                    ? `of ${data.retention.total} cards that had gone to sleep came back to you.`
                    : "Review a few sleeping cards and this number appears."}
                </p>
              </div>

              <div className="rounded-[26px] border border-black/[0.06] bg-white p-6">
                <h2 className="font-display text-xl font-black text-[#23201d]">
                  Coming back — next 30 days
                </h2>
                <p className="text-sm font-semibold text-[#6d6355]">
                  Your future workload, so nothing piles up by surprise.
                </p>
                <div className="mt-5 flex h-28 items-end gap-[3px]">
                  {data.forecast.map((f) => {
                    const peak = Math.max(1, ...data.forecast.map((x) => x.cards));
                    return (
                      <span
                        key={f.day}
                        title={`${f.day}: ${f.cards} cards`}
                        className="flex-1 rounded-t-[4px] bg-[#e6d9c2]"
                        style={{ height: `${Math.max(3, (f.cards / peak) * 100)}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>



            {/* Daily activity */}
            <section className="mt-6 rounded-[26px] border border-black/[0.06] bg-white p-6">
              <h2 className="font-display text-xl font-black text-[#23201d]">Last 30 days</h2>
              <p className="text-sm font-semibold text-[#6d6355]">
                Cards reviewed each day, and the minutes behind them.
              </p>
              {data.daily.length === 0 ? (
                <p className="mt-6 text-sm font-bold text-[#a79c8c]">
                  No reviews yet — start a session and this fills in.
                </p>
              ) : (
                <div className="mt-6 flex h-40 items-end gap-1.5">
                  {data.daily.map((d) => (
                    <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                      <div
                        title={`${d.day}: ${d.cards} cards · ${d.minutes} min`}
                        className="w-full rounded-t-md bg-[var(--rita-green)] transition-all"
                        style={{ height: `${Math.max(4, (d.cards / maxCards) * 140)}px` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Subjects */}
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-[26px] border border-black/[0.06] bg-white p-6">
                <h2 className="font-display text-xl font-black text-[#23201d]">
                  Accuracy per subject
                </h2>
                {data.subjects.length === 0 ? (
                  <p className="mt-4 text-sm font-bold text-[#a79c8c]">Nothing graded yet.</p>
                ) : (
                  <ul className="mt-4 grid gap-3">
                    {data.subjects.map((s) => (
                      <li key={s.subject}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-black text-[#23201d]">{s.subject}</span>
                          <span className="shrink-0 font-bold text-[#6d6355]">
                            {s.accuracy}% · {s.reviews} reviews
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.07]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s.accuracy}%`,
                              background:
                                s.accuracy >= 80
                                  ? "var(--rita-green)"
                                  : s.accuracy >= 60
                                    ? "#f0a95c"
                                    : "#d1795e",
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-[26px] border border-black/[0.06] bg-white p-6">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f6ddd5] text-[#7d3421]">
                    <TrendingDown size={16} />
                  </span>
                  <h2 className="font-display text-xl font-black text-[#23201d]">Weakest three</h2>
                </div>
                {weakest.length === 0 ? (
                  <p className="mt-4 text-sm font-bold text-[#a79c8c]">
                    Review a few more cards and Rita will point out the shaky subjects.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-2">
                    {weakest.map((s) => (
                      <li
                        key={s.subject}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbf5e9] px-4 py-3"
                      >
                        <span className="truncate text-sm font-black text-[#23201d]">
                          {s.subject}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-[#7d3421]">
                          {s.accuracy}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/study"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[var(--rita-green)] py-3 text-[15px] font-semibold text-[color:var(--rita-green-ink)]"
                >
                  Study these now
                </Link>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

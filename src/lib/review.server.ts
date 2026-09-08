/**
 * Server-side FSRS scheduler (FSRS-4.5 shaped) with Anki-style learning steps.
 *
 * Grades: 0 again · 1 hard · 2 good · 3 easy  (FSRS G = grade + 1)
 *
 * Every card carries three numbers:
 *  - difficulty  1..10  how much work this card is
 *  - stability   days   how long the memory lasts before recall drops to 90%
 *  - retrievability     the chance you'd recall it right now
 *
 * The next date is chosen so recall lands on the student's target retention.
 */

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 24 * 60 * 60_000;
const MIN_MINUTES = 1 / 1440;

/** Same-session steps for a brand-new card, in days. */
export const LEARN_STEPS = [MIN_MINUTES, 10 * MIN_MINUTES];
/** Steps a lapsed card walks back through. */
export const RELEARN_STEPS = [10 * MIN_MINUTES];

export const MAX_INTERVAL = 365 * 3;
export const DEFAULT_RETENTION = 0.9;

/** Miss a card this many times and it stops being worth drilling as-is. */
export const LEECH_THRESHOLD = 6;

export type ReviewState = {
  ease: number;
  difficulty: number;
  stability: number;
  interval_days: number;
  reps: number;
  lapses: number;
  step: number;
  state: string;
  due_at: string;
  last_review_at: string;
};

export type PrevState = {
  ease?: number | null;
  difficulty?: number | null;
  stability?: number | null;
  interval_days?: number | null;
  reps?: number | null;
  lapses?: number | null;
  step?: number | null;
  state?: string | null;
  last_review_at?: string | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, p = 4) => Number(v.toFixed(p));

/** Chance of recalling a card after `elapsed` days with this stability. */
export function retrievability(elapsedDays: number, stability: number) {
  if (!stability || stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** How many days until recall falls to the requested retention. */
export function intervalFor(stability: number, retention = DEFAULT_RETENTION) {
  const r = clamp(retention, 0.7, 0.98);
  return (stability / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
}

function initialStability(g: number) {
  return clamp(W[g - 1]!, 0.1, 100);
}

function initialDifficulty(g: number) {
  return clamp(W[4]! - (g - 3) * W[5]!, 1, 10);
}

function nextDifficulty(d: number, g: number) {
  const delta = d - W[6]! * (g - 3);
  // Mean reversion towards the "easy" anchor keeps difficulty from drifting.
  return clamp(W[7]! * initialDifficulty(4) + (1 - W[7]!) * delta, 1, 10);
}

function stabilityAfterRecall(d: number, s: number, r: number, g: number) {
  const hard = g === 2 ? W[15]! : 1;
  const easy = g === 4 ? W[16]! : 1;
  const growth =
    1 +
    Math.exp(W[8]!) *
      (11 - d) *
      Math.pow(s, -W[9]!) *
      (Math.exp(W[10]! * (1 - r)) - 1) *
      hard *
      easy;
  return clamp(s * growth, 0.1, 36500);
}

function stabilityAfterLapse(d: number, s: number, r: number) {
  const next =
    W[11]! * Math.pow(d, -W[12]!) * (Math.pow(s + 1, W[13]!) - 1) * Math.exp(W[14]! * (1 - r));
  return clamp(Math.min(next, s), 0.1, 36500);
}

/** ±5% jitter so hundreds of cards don't all land on the same day. */
function fuzz(days: number, seed: string) {
  if (days < 2.5) return days;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  const spread = ((h / 100000) * 2 - 1) * 0.05;
  return days * (1 + spread);
}

export type ScheduleOpts = {
  flagged?: boolean;
  retention?: number;
  now?: number;
  /** Only used for jitter, so the same card always jitters the same way. */
  seed?: string;
};

export function schedule(prev: PrevState, grade: number, opts?: ScheduleOpts): ReviewState {
  const now = opts?.now ?? Date.now();
  const retention = opts?.retention ?? DEFAULT_RETENTION;
  const g = clamp(grade, 0, 3) + 1;

  const stateIn = prev.state ?? "new";
  let reps = prev.reps ?? 0;
  let lapses = prev.lapses ?? 0;
  let step = prev.step ?? 0;

  const hadMemory = !!prev.stability && Number(prev.stability) > 0;
  const elapsed = prev.last_review_at
    ? Math.max(0, (now - new Date(prev.last_review_at).getTime()) / DAY)
    : Number(prev.interval_days ?? 0);

  let difficulty: number;
  let stability: number;

  if (!hadMemory) {
    difficulty = initialDifficulty(g);
    stability = initialStability(g);
  } else {
    const d0 = clamp(Number(prev.difficulty ?? 5), 1, 10);
    const s0 = clamp(Number(prev.stability), 0.1, 36500);
    const r = retrievability(elapsed, s0);
    difficulty = nextDifficulty(d0, g);
    stability = g === 1 ? stabilityAfterLapse(difficulty, s0, r) : stabilityAfterRecall(difficulty, s0, r, g);
  }

  let interval: number;
  let state: string;

  const graduate = () => {
    state = "review";
    step = 0;
    return Math.max(1, intervalFor(stability, retention));
  };

  const wasInReview = stateIn === "review" || stateIn === "mastered";

  if (g === 1) {
    // Again — a lapse. Back into the same sitting, memory dented not erased.
    if (wasInReview) lapses += 1;
    state = "relearning";
    step = 0;
    interval = RELEARN_STEPS[0]!;
  } else if (stateIn === "new" || stateIn === "learning") {
    reps += 1;
    if (g === 4) {
      interval = graduate();
    } else if (g === 2) {
      // Hard repeats the current step.
      state = "learning";
      interval = LEARN_STEPS[Math.min(step, LEARN_STEPS.length - 1)]!;
    } else {
      const next = step + 1;
      if (next >= LEARN_STEPS.length) {
        interval = graduate();
      } else {
        state = "learning";
        step = next;
        interval = LEARN_STEPS[next]!;
      }
    }
  } else if (stateIn === "relearning") {
    reps += 1;
    if (g === 2) {
      state = "relearning";
      interval = RELEARN_STEPS[Math.min(step, RELEARN_STEPS.length - 1)]!;
    } else {
      interval = graduate();
    }
  } else {
    reps += 1;
    state = "review";
    interval = Math.max(1, intervalFor(stability, retention));
  }

  if (state! === "review") {
    interval = fuzz(interval, opts?.seed ?? "seed");
    // A card you flagged is one you already know fights you: it comes back
    // roughly twice as often until the flag is cleared.
    if (opts?.flagged) interval = Math.max(1, interval * 0.5);
    // Cards you keep losing get their growth capped so they can't run away.
    if (lapses >= LEECH_THRESHOLD && interval > 7) interval = 7;
    interval = clamp(interval, 1, MAX_INTERVAL);
  }

  const dueMs = now + interval * DAY;
  // "mastered" is a label for the student, not a scheduler state.
  const label = state! === "review" && interval >= 21 ? "mastered" : state!;

  return {
    ease: clamp(Number(prev.ease ?? 2.5), 1.3, 2.8),
    difficulty: round(difficulty, 3),
    stability: round(stability, 3),
    interval_days: round(interval, 4),
    reps,
    lapses,
    step,
    state: label,
    due_at: new Date(dueMs).toISOString(),
    last_review_at: new Date(now).toISOString(),
  };
}

/**
 * What the student will see under each button before they press it. Kept in
 * one place so the preview and the real schedule can never drift apart.
 */
export function previewIntervals(prev: PrevState, opts?: ScheduleOpts) {
  return [0, 1, 2, 3].map((g) => schedule(prev, g, opts).interval_days);
}

/** Plain-language memory strength for the card's little meter. */
export function memoryLabel(stability?: number | null) {
  const s = Number(stability ?? 0);
  if (!s) return "brand new";
  const d = intervalFor(s, DEFAULT_RETENTION);
  if (d < 1) return "fragile — minutes";
  if (d < 7) return `about ${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`;
  if (d < 60) return `about ${Math.round(d / 7)} week${Math.round(d / 7) === 1 ? "" : "s"}`;
  if (d < 365) return `about ${Math.round(d / 30)} months`;
  return `over a year`;
}

/** 0..100 bar: how deep this memory is (a month of retention ≈ full bar). */
export function memoryStrength(stability?: number | null) {
  const d = intervalFor(Number(stability ?? 0) || 0.001, DEFAULT_RETENTION);
  return clamp(Math.round((Math.log(1 + d) / Math.log(1 + 120)) * 100), 0, 100);
}

/** Longest run of goal-met (or frozen) days ending today or yesterday. */
export function streakFrom(days: { day: string; goal_met: boolean; frozen: boolean }[]) {
  const met = new Set(days.filter((d) => d.goal_met || d.frozen).map((d) => d.day));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const cursor = new Date(today);
  if (!met.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (met.has(iso(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

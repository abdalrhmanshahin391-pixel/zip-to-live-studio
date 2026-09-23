import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Bot,
  BookOpen,
  Check,
  ChevronRight,
  KeyRound,
  Layers,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Plus,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { RitaStage, type RitaMood } from "@/components/rita-live/RitaStage";
import type { RitaEconomicController } from "@/lib/rita-economic.client";
import type { RitaEconomicReply } from "@/lib/rita-economic-response.client";
import type { RitaPcmPlayerController } from "@/lib/rita-pcm-player.client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isGermanItem, learningKey, type LearningItem, type SaveTarget } from "@/lib/rita-learning";
import {
  RitaApiError,
  parseServerTiming,
  readRitaPayload,
  ritaApiError,
  type RitaErrorPayload,
} from "@/lib/rita-response";
import { hasRitaLanguageLearningIntent } from "@/lib/rita-learning-intent";

type Persona = "kind" | "direct" | "playful" | "strict";
type Message = {
  id: string;
  role: "rita" | "you";
  text: string;
  correction?: string;
  learningIds?: string[];
};
type LearningEntry = LearningItem & { id: string };
type Destinations = {
  flashSubjects: { id: string; parent_id: string | null; name: string }[];
  germanSubjects: { id: string; name: string }[];
  germanSubtopics: { id: string; subject_id: string; name: string }[];
};
type SaveIntentResult = {
  saveRequest: SaveTarget | "none";
  destinationName: string;
  rememberDestination: boolean;
};

const WELCOME: Message = {
  id: "welcome",
  role: "rita",
  text: "Hi, I’m Rita. What would you like to practise?",
};
const EMPTY_DESTINATIONS: Destinations = {
  flashSubjects: [],
  germanSubjects: [],
  germanSubtopics: [],
};
const loadEconomic = createClientOnlyFn(() => import("@/lib/rita-economic.client"));
const loadEconomicResponse = createClientOnlyFn(
  () => import("@/lib/rita-economic-response.client"),
);
const loadPcmPlayer = createClientOnlyFn(() => import("@/lib/rita-pcm-player.client"));

function matchingDestination(spoken: string, target: SaveTarget, data: Destinations) {
  const clean = spoken
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!clean) return null;
  const options =
    target === "flashcards"
      ? data.flashSubjects.map((subject) => ({ id: subject.id, label: subject.name }))
      : data.germanSubtopics.map((subtopic) => ({
          id: subtopic.id,
          label:
            `${data.germanSubjects.find((subject) => subject.id === subtopic.subject_id)?.name ?? ""} ${subtopic.name}`.trim(),
          short: subtopic.name,
        }));
  const normalized = options.map((option) => ({
    ...option,
    full: option.label
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
    shortClean: ("short" in option && typeof option.short === "string"
      ? option.short
      : option.label
    )
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
  }));
  const exact = normalized.filter((option) => clean === option.full || clean === option.shortClean);
  if (exact.length === 1) return exact[0].id;
  const mentioned = normalized.filter(
    (option) =>
      option.full.length > 2 &&
      (clean.includes(option.full) ||
        (option.shortClean.length > 3 && clean.includes(option.shortClean))),
  );
  return mentioned.length === 1 ? mentioned[0].id : null;
}

export const Route = createFileRoute("/rita-live")({
  head: () => ({
    meta: [{ title: "Talk with Rita — RitaJet" }, { name: "robots", content: "noindex" }],
  }),
  component: RitaLivePage,
});

function RitaLivePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const persona: Persona = "kind";
  const language = "automatic";
  const [dialect, setDialect] = useState("unknown");
  const [accentPreference, setAccentPreference] = useState("");
  const [mood, setMood] = useState<RitaMood>("ready");
  const [status, setStatus] = useState("Preparing Rita…");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [learningItems, setLearningItems] = useState<LearningEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panel, setPanel] = useState<"words" | SaveTarget | null>(null);
  const [destinations, setDestinations] = useState<Destinations>(EMPTY_DESTINATIONS);
  const [destinationId, setDestinationId] = useState("");
  const [germanSubjectId, setGermanSubjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState<"flash" | "german_subject" | "german_subtopic" | null>(
    null,
  );
  const [flashParentId, setFlashParentId] = useState("");
  const [rememberChoice, setRememberChoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [learningNotice, setLearningNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connectedMode, setConnectedMode] = useState<"economic_v2" | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [premiumVoice, setPremiumVoice] = useState(true);
  const [hasReplay, setHasReplay] = useState(false);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [lastVoiceLatencyMs, setLastVoiceLatencyMs] = useState<number | null>(null);
  const [lastVoiceTimings, setLastVoiceTimings] = useState<Record<string, number>>({});

  const economic = useRef<RitaEconomicController | null>(null);
  const pcmPlayer = useRef<RitaPcmPlayerController | null>(null);
  const lastSpoken = useRef("");
  const sessionId = useRef<string | null>(null);
  const lastSpeechBlob = useRef<Blob | null>(null);
  const speechAbort = useRef<AbortController | null>(null);
  const turnAbort = useRef<AbortController | null>(null);
  const outputFrame = useRef<number | null>(null);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const transcript = useRef<HTMLDivElement | null>(null);
  const stickToLatest = useRef(true);
  const messagesRef = useRef(messages);
  const learningRef = useRef(learningItems);
  const destinationsRef = useRef(destinations);
  const selectedIdsRef = useRef(selectedIds);
  const panelRef = useRef(panel);
  const preferredRef = useRef<Record<SaveTarget, string | null>>({
    flashcards: null,
    german_lab: null,
  });
  const lessonEpoch = useRef(0);
  const activeRef = useRef(active);
  const processingRef = useRef(processing);
  const mutedRef = useRef(muted);
  const voiceTurnStartedAt = useRef<number | null>(null);
  const settingsRef = useRef({ persona, language, dialect, accentPreference });
  const processTurnRef = useRef<
    (args: {
      text: string;
      transcriptLanguage?: string;
      durationMs?: number;
      addUser?: boolean;
    }) => Promise<void>
  >(async () => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    learningRef.current = learningItems;
  }, [learningItems]);
  useEffect(() => {
    destinationsRef.current = destinations;
  }, [destinations]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    settingsRef.current = { persona, language, dialect, accentPreference };
  }, [accentPreference, dialect]);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Please sign in before talking with Rita.");
    return token;
  }, []);

  const loadDestinations = useCallback(async () => {
    const epoch = lessonEpoch.current;
    const token = await getToken();
    const response = await fetch("/api/rita/learning", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await readRitaPayload<Destinations & RitaErrorPayload>(response);
    if (!response.ok || !data) throw ritaApiError(data, "Could not load your subjects.");
    if (epoch !== lessonEpoch.current) throw new Error("Lesson ended.");
    destinationsRef.current = data;
    setDestinations(data);
    return data;
  }, [getToken]);

  const addLearning = useCallback((items: LearningItem[]) => {
    const next = [...learningRef.current];
    const ids: string[] = [];
    for (const item of items.slice(0, 3)) {
      if (!item.term?.trim() || !item.meaning?.trim()) continue;
      const key = learningKey(item);
      const existing = next.find((entry) => learningKey(entry) === key);
      if (existing) {
        ids.push(existing.id);
      } else if (next.length < 80) {
        const entry: LearningEntry = { ...item, id: crypto.randomUUID() };
        next.push(entry);
        ids.push(entry.id);
      }
    }
    learningRef.current = next;
    setLearningItems(next);
    return ids;
  }, []);

  const openWords = useCallback((ids?: string[]) => {
    const chosen = ids?.length ? ids : learningRef.current.map((item) => item.id);
    selectedIdsRef.current = chosen;
    setSelectedIds(chosen);
    panelRef.current = "words";
    setPanel("words");
    setLearningNotice("");
  }, []);

  const openSave = useCallback(
    async (target: SaveTarget, ids?: string[]) => {
      const epoch = lessonEpoch.current;
      const chosen = ids?.length ? ids : learningRef.current.map((item) => item.id);
      selectedIdsRef.current = chosen;
      setSelectedIds(chosen);
      setLearningNotice("");
      setDestinationId(preferredRef.current[target] ?? "");
      setRememberChoice(false);
      panelRef.current = target;
      setPanel(target);
      try {
        await loadDestinations();
      } catch (cause) {
        if (epoch === lessonEpoch.current)
          setLearningNotice(
            cause instanceof Error ? cause.message : "Could not load your subjects.",
          );
      }
    },
    [loadDestinations],
  );

  const saveLearning = useCallback(
    async (target: SaveTarget, selectedDestination: string, ids: string[], remember = false) => {
      const epoch = lessonEpoch.current;
      if (!selectedDestination) {
        setLearningNotice("Choose a subject first.");
        return;
      }
      const selected = learningRef.current.filter((item) => ids.includes(item.id));
      const eligible = target === "german_lab" ? selected.filter(isGermanItem) : selected;
      if (!eligible.length) {
        setLearningNotice(
          target === "german_lab"
            ? "No German words or sentences to save yet."
            : "No words to save yet.",
        );
        return;
      }
      setSaving(true);
      setLearningNotice("");
      let totalSaved = 0;
      let totalSkipped = 0;
      try {
        const token = await getToken();
        for (let index = 0; index < eligible.length; index += 25) {
          const response = await fetch("/api/rita/learning", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save",
              target,
              destinationId: selectedDestination,
              items: eligible.slice(index, index + 25),
            }),
          });
          const result = await readRitaPayload<
            { saved?: number; skipped?: number } & RitaErrorPayload
          >(response);
          if (!response.ok || !result) throw ritaApiError(result, "Could not save those items.");
          totalSaved += Number(result.saved ?? 0);
          totalSkipped += Number(result.skipped ?? 0);
        }
        if (epoch !== lessonEpoch.current) return;
        if (remember) preferredRef.current[target] = selectedDestination;
        setLearningNotice(
          totalSaved
            ? `${totalSaved} ${totalSaved === 1 ? "item" : "items"} saved${totalSkipped ? ` · ${totalSkipped} already there` : ""}.`
            : "Those items are already in that subject.",
        );
        panelRef.current = null;
        setPanel(null);
      } catch (cause) {
        if (epoch !== lessonEpoch.current) return;
        const message = cause instanceof Error ? cause.message : "Could not save those items.";
        setLearningNotice(
          totalSaved ? `${totalSaved} saved, but the rest failed. ${message}` : message,
        );
      } finally {
        if (epoch === lessonEpoch.current) setSaving(false);
      }
    },
    [getToken],
  );

  const createDestination = async () => {
    if (!creating || !newName.trim()) return;
    const epoch = lessonEpoch.current;
    setSaving(true);
    setLearningNotice("");
    try {
      const token = await getToken();
      const body =
        creating === "flash"
          ? {
              action: "create_flash_subject",
              name: newName.trim(),
              parentId: flashParentId || null,
            }
          : creating === "german_subject"
            ? { action: "create_german_subject", name: newName.trim() }
            : {
                action: "create_german_subtopic",
                name: newName.trim(),
                subjectId: germanSubjectId,
              };
      const response = await fetch("/api/rita/learning", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readRitaPayload<{ id?: string } & RitaErrorPayload>(response);
      if (!response.ok || !result) throw ritaApiError(result, "Could not create that subject.");
      await loadDestinations();
      if (epoch !== lessonEpoch.current) return;
      if (creating === "german_subject") setGermanSubjectId(String(result.id || ""));
      else setDestinationId(String(result.id || ""));
      setCreating(null);
      setNewName("");
    } catch (cause) {
      if (epoch === lessonEpoch.current)
        setLearningNotice(
          cause instanceof Error ? cause.message : "Could not create that subject.",
        );
    } finally {
      if (epoch === lessonEpoch.current) setSaving(false);
    }
  };

  const toggleSelected = (id: string) => {
    const next = selectedIdsRef.current.includes(id)
      ? selectedIdsRef.current.filter((value) => value !== id)
      : [...selectedIdsRef.current, id];
    selectedIdsRef.current = next;
    setSelectedIds(next);
  };

  const editLearning = (id: string, field: "term" | "meaning", value: string) => {
    const next = learningRef.current.map((item) =>
      item.id === id ? { ...item, [field]: value } : item,
    );
    learningRef.current = next;
    setLearningItems(next);
  };

  const removeLearning = (id: string) => {
    const next = learningRef.current.filter((item) => item.id !== id);
    learningRef.current = next;
    setLearningItems(next);
    selectedIdsRef.current = selectedIdsRef.current.filter((value) => value !== id);
    setSelectedIds(selectedIdsRef.current);
  };

  const add = useCallback(
    (role: Message["role"], text: string, correction?: string, learningIds?: string[]) => {
      const clean = text.trim();
      if (!clean) return;
      const id = crypto.randomUUID();
      setMessages((all) => [
        ...all.slice(-179),
        { id, role, text: clean, correction: correction?.trim(), learningIds },
      ]);
      return id;
    },
    [],
  );

  useEffect(() => {
    if (stickToLatest.current) {
      messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, processing]);

  const scrollToLatest = useCallback(() => {
    stickToLatest.current = true;
    setShowJumpToLatest(false);
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleTranscriptScroll = useCallback(() => {
    const element = transcript.current;
    if (!element) return;
    const atLatest = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    stickToLatest.current = atLatest;
    setShowJumpToLatest(!atLatest);
  }, []);

  const stopOutputMeter = useCallback(() => {
    if (outputFrame.current) cancelAnimationFrame(outputFrame.current);
    outputFrame.current = null;
    setOutputLevel(0);
  }, []);

  const startOutputMeter = useCallback(() => {
    const started = performance.now();
    const tick = () => {
      const phase = (performance.now() - started) / 1000;
      setOutputLevel(
        0.28 + 0.18 * Math.abs(Math.sin(phase * 9)) + 0.1 * Math.abs(Math.sin(phase * 17)),
      );
      outputFrame.current = requestAnimationFrame(tick);
    };
    stopOutputMeter();
    tick();
  }, [stopOutputMeter]);

  const stopSpeaking = useCallback(() => {
    speechAbort.current?.abort();
    speechAbort.current = null;
    stopOutputMeter();
    pcmPlayer.current?.interrupt();
    economic.current?.setOutputSpeaking(false);
  }, [stopOutputMeter]);

  const speakEconomic = useCallback(
    async (result: RitaEconomicReply, token: string) => {
      stopSpeaking();
      setNeedsTapToPlay(false);
      lastSpeechBlob.current = null;
      setHasReplay(false);
      const controller = new AbortController();
      speechAbort.current = controller;
      setStatus("OpenAI voice is streaming…");
      try {
        const response = await fetch("/api/rita/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            turnId: result.turnId,
            text: result.reply,
            language: result.detectedLanguage,
            dialect: result.detectedDialect,
            emotion: result.emotion,
          }),
          signal: controller.signal,
        });
        setLastVoiceTimings((current) => ({
          ...current,
          ...parseServerTiming(response.headers.get("Server-Timing")),
        }));
        if (!response.ok) {
          const detail = await readRitaPayload<RitaErrorPayload>(response);
          throw ritaApiError(detail, "Rita’s voice request failed.");
        }
        if (!activeRef.current || !pcmPlayer.current || controller.signal.aborted) return;
        const blob = await pcmPlayer.current.playResponse(response, controller.signal);
        if (controller.signal.aborted) return;
        lastSpeechBlob.current = blob;
        setHasReplay(true);
        setPremiumVoice(true);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof RitaApiError)
          console.error("Rita speech request failed", {
            code: cause.code,
            traceId: cause.traceId,
          });
        setMood(activeRef.current ? "listening" : "ready");
        setStatus("OpenAI TTS failed");
        setError(
          cause instanceof Error
            ? `tts_openai: ${cause.message}`
            : "tts_openai: Rita’s voice is unavailable.",
        );
      } finally {
        if (speechAbort.current === controller) speechAbort.current = null;
      }
    },
    [stopSpeaking],
  );

  const replaySpeech = useCallback(async () => {
    const blob = lastSpeechBlob.current;
    if (!blob || !pcmPlayer.current) return;
    stopSpeaking();
    setError(null);
    try {
      economic.current?.setOutputSpeaking(true);
      await pcmPlayer.current.replay(blob);
    } catch (cause) {
      economic.current?.setOutputSpeaking(false);
      setError(cause instanceof Error ? `pcm_playback: ${cause.message}` : "pcm_playback failed");
    }
  }, [stopSpeaking]);

  const handleSaveIntent = useCallback(
    async (result: SaveIntentResult) => {
      const epoch = lessonEpoch.current;
      const pending =
        panelRef.current === "flashcards" || panelRef.current === "german_lab"
          ? panelRef.current
          : null;
      const target = result.saveRequest !== "none" ? result.saveRequest : pending;
      if (!target) return;
      let data = destinationsRef.current;
      try {
        data = await loadDestinations();
      } catch {
        if (epoch === lessonEpoch.current) await openSave(target);
        return;
      }
      if (epoch !== lessonEpoch.current) return;
      const ids =
        pending === target && selectedIdsRef.current.length
          ? selectedIdsRef.current
          : learningRef.current.map((item) => item.id);
      // Only a deliberate destination intent may trigger a write. Unrelated speech
      // while the picker is open must not be mistaken for a subject name.
      const named = result.destinationName;
      const matched = matchingDestination(named, target, data);
      const chosen =
        matched || (result.saveRequest !== "none" && !named ? preferredRef.current[target] : null);
      if (chosen) {
        if (result.rememberDestination && !learningRef.current.length) {
          preferredRef.current[target] = chosen;
          panelRef.current = null;
          setPanel(null);
          setLearningNotice("I’ll use that subject for this lesson.");
          return;
        }
        await saveLearning(target, chosen, ids, result.rememberDestination);
        return;
      }
      if (result.saveRequest !== "none") {
        await openSave(target, ids);
        if (epoch !== lessonEpoch.current) return;
        setLearningNotice(
          named
            ? "I couldn’t match that subject. Please choose it below."
            : "Choose where to save these items.",
        );
      }
    },
    [loadDestinations, openSave, saveLearning],
  );

  const extractLearningInBackground = useCallback(
    (spoken: string, reply: string, replyId: string, existingToken?: string) => {
      if (!spoken.trim() || !reply.trim()) return;
      const epoch = lessonEpoch.current;
      void (existingToken ? Promise.resolve(existingToken) : getToken())
        .then((token) =>
          fetch("/api/rita/extract", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              spoken,
              reply,
              saveContext:
                panelRef.current === "flashcards" || panelRef.current === "german_lab"
                  ? panelRef.current
                  : "none",
            }),
          }),
        )
        .then((response) =>
          response.ok
            ? readRitaPayload<{
                learningItems?: LearningItem[];
                saveRequest?: SaveTarget | "none";
                destinationName?: string;
                rememberDestination?: boolean;
              }>(response)
            : null,
        )
        .then((result) => {
          if (!result || epoch !== lessonEpoch.current) return;
          const ids = addLearning(Array.isArray(result.learningItems) ? result.learningItems : []);
          if (ids.length)
            setMessages((all) =>
              all.map((message) =>
                message.id === replyId ? { ...message, learningIds: ids } : message,
              ),
            );
          void handleSaveIntent({
            saveRequest:
              result.saveRequest === "flashcards" || result.saveRequest === "german_lab"
                ? result.saveRequest
                : "none",
            destinationName: String(result.destinationName || ""),
            rememberDestination: result.rememberDestination === true,
          });
        })
        .catch(() => undefined); // Learning extraction never delays spoken audio.
    },
    [addLearning, getToken, handleSaveIntent],
  );

  const processTurn = useCallback(
    async ({
      text,
      transcriptLanguage = "unknown",
      durationMs = 0,
      addUser = false,
    }: {
      text: string;
      transcriptLanguage?: string;
      durationMs?: number;
      addUser?: boolean;
    }) => {
      const spoken = text.trim();
      if (!spoken || (addUser && mutedRef.current)) return;
      voiceTurnStartedAt.current = performance.now();
      const epoch = lessonEpoch.current;
      stopSpeaking();
      setNeedsTapToPlay(false);
      turnAbort.current?.abort();
      const controller = new AbortController();
      turnAbort.current = controller;
      setError(null);
      setProcessing(true);
      processingRef.current = true;
      setMood("thinking");
      setStatus("Rita is thinking…");
      try {
        const token = await getToken();
        if (epoch !== lessonEpoch.current || controller.signal.aborted) return;
        const current = settingsRef.current;
        const recent = messagesRef.current.slice(-8).map((item) => ({
          role: item.role === "rita" ? "assistant" : "user",
          content: item.text,
        }));
        if (recent.at(-1)?.role === "user" && recent.at(-1)?.content === spoken) recent.pop();
        if (addUser) add("you", spoken);
        const stableAccent =
          current.accentPreference ||
          (transcriptLanguage.startsWith("ar")
            ? "ar-JO"
            : transcriptLanguage.startsWith("de")
              ? "de-DE"
              : current.dialect);
        let streamedReply = "";
        let replyAdded = false;
        const replyId = crypto.randomUUID();
        const { streamRitaEconomicReply } = await loadEconomicResponse();
        const result = await streamRitaEconomicReply({
          token,
          signal: controller.signal,
          body: {
            transcript: spoken,
            transcriptLanguage,
            inputAudioMs: durationMs,
            sessionId: sessionId.current,
            personality: current.persona,
            accent: stableAccent,
            history: recent,
          },
          onDelta(delta) {
            if (epoch !== lessonEpoch.current || controller.signal.aborted) return;
            streamedReply += delta;
            setCaption(streamedReply);
            if (!replyAdded) {
              replyAdded = true;
              setMessages((all) => [
                ...all.slice(-179),
                { id: replyId, role: "rita", text: streamedReply },
              ]);
            } else {
              setMessages((all) =>
                all.map((message) =>
                  message.id === replyId ? { ...message, text: streamedReply } : message,
                ),
              );
            }
          },
        });
        if (epoch !== lessonEpoch.current || controller.signal.aborted) return;
        if (!replyAdded) {
          setMessages((all) => [
            ...all.slice(-179),
            { id: replyId, role: "rita", text: result.reply },
          ]);
        } else {
          setMessages((all) =>
            all.map((message) =>
              message.id === replyId ? { ...message, text: result.reply } : message,
            ),
          );
        }
        setCaption(result.reply);
        setDialect(stableAccent || result.detectedDialect || "standard");
        setLastVoiceTimings((value) => ({ ...value, answer: result.totalMs }));
        if (turnAbort.current === controller) {
          setProcessing(false);
          processingRef.current = false;
        }
        if (activeRef.current) {
          const shouldExtract =
            hasRitaLanguageLearningIntent(spoken) || panelRef.current !== null;
          if (shouldExtract) {
            window.setTimeout(() => {
              if (epoch === lessonEpoch.current)
                extractLearningInBackground(spoken, result.reply, replyId, token);
            }, 50);
          }
          await speakEconomic(result, token);
        } else {
          voiceTurnStartedAt.current = null;
          setMood("ready");
          setStatus("Reply ready");
        }
      } catch (cause) {
        if (epoch !== lessonEpoch.current) return;
        if ((cause as Error)?.name === "AbortError") return;
        setMood(activeRef.current ? "listening" : "ready");
        setStatus(activeRef.current ? "Rita is listening" : "Ready to start");
        voiceTurnStartedAt.current = null;
        setError(
          cause instanceof Error
            ? cause.message
            : "gpt_response: Rita Economic v2 could not answer.",
        );
      } finally {
        if (turnAbort.current === controller) {
          turnAbort.current = null;
          if (epoch === lessonEpoch.current) {
            setProcessing(false);
            processingRef.current = false;
          }
        }
      }
    },
    [add, extractLearningInBackground, getToken, speakEconomic, stopSpeaking],
  );
  processTurnRef.current = processTurn;

  const endSession = useCallback(() => {
    lessonEpoch.current += 1;
    turnAbort.current?.abort();
    turnAbort.current = null;
    economic.current?.stop();
    economic.current = null;
    pcmPlayer.current?.close();
    pcmPlayer.current = null;
    lastSpoken.current = "";
    stopSpeaking();
    const closingId = sessionId.current;
    sessionId.current = null;
    if (closingId) {
      void getToken()
        .then((token) =>
          fetch("/api/rita/session", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "end", sessionId: closingId }),
            keepalive: true,
          }),
        )
        .catch(() => undefined);
    }
    setActive(false);
    setConnectedMode(null);
    activeRef.current = false;
    setStarting(false);
    setProcessing(false);
    processingRef.current = false;
    setMuted(false);
    setInputLevel(0);
    voiceTurnStartedAt.current = null;
    setLastVoiceLatencyMs(null);
    setLastVoiceTimings({});
    setMood("ready");
    setStatus("Lesson ended");
    setCaption("");
    setDraft("");
    setError(null);
    setDialect("unknown");
    messagesRef.current = [WELCOME];
    setMessages([WELCOME]);
    learningRef.current = [];
    setLearningItems([]);
    selectedIdsRef.current = [];
    setSelectedIds([]);
    preferredRef.current = { flashcards: null, german_lab: null };
    panelRef.current = null;
    setPanel(null);
    setLearningNotice("");
    setDestinationId("");
    setGermanSubjectId("");
    setFlashParentId("");
    setNewName("");
    setCreating(null);
    setRememberChoice(false);
    setSaving(false);
    lastSpeechBlob.current = null;
    setHasReplay(false);
    setNeedsTapToPlay(false);
  }, [getToken, stopSpeaking]);

  useEffect(() => () => endSession(), [endSession]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getToken()
      .then((token) =>
        fetch("/api/rita/session", { headers: { Authorization: `Bearer ${token}` } }),
      )
      .then((response) =>
        response.ok
          ? readRitaPayload<{
              configured?: boolean;
              pilotMode?: "economic_v2";
              allowance?: { premiumVoice?: boolean };
            }>(response)
          : null,
      )
      .then((result) => {
        if (cancelled) return;
        setConfigured(Boolean(result?.configured));
        setPremiumVoice(result?.allowance?.premiumVoice !== false);
        setStatus(
          result?.configured
            ? "Rita Economic v2 is ready"
            : "Rita needs both OpenAI and Deepgram keys",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setConfigured(false);
          setStatus("Rita’s voice service is unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, user]);

  const beginSession = async () => {
    if (activeRef.current || starting) return;
    const epoch = lessonEpoch.current;
    setStarting(true);
    setError(null);
    setStatus("Requesting microphone access…");
    setMood("thinking");
    try {
      const { createRitaPcmPlayer } = await loadPcmPlayer();
      pcmPlayer.current = await createRitaPcmPlayer({
        onStarted: () => {
          if (voiceTurnStartedAt.current !== null) {
            setLastVoiceLatencyMs(Math.round(performance.now() - voiceTurnStartedAt.current));
            voiceTurnStartedAt.current = null;
          }
          setError(null);
          setNeedsTapToPlay(false);
          economic.current?.setOutputSpeaking(true);
          setMood("talking");
          setStatus("Rita is speaking — you can interrupt anytime");
          startOutputMeter();
        },
        onEnded: () => {
          stopOutputMeter();
          economic.current?.setOutputSpeaking(false);
          setMood(activeRef.current ? "listening" : "ready");
          setStatus(activeRef.current ? "Rita Economic v2 is listening" : "Lesson paused");
        },
      });
      const token = await getToken();
      if (epoch !== lessonEpoch.current) return;
      const response = await fetch("/api/rita/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          personality: persona,
          language,
          accentPreference,
          browserLocale: navigator.language || "",
          clientLabel: navigator.userAgent.slice(0, 100),
        }),
      });
      const result = await readRitaPayload<
        {
          ok?: boolean;
          configured?: boolean;
          sessionId?: string;
          pilotMode?: "economic_v2";
          allowance?: { premiumVoice?: boolean };
        } & RitaErrorPayload
      >(response);
      if (epoch !== lessonEpoch.current) {
        if (result?.sessionId) {
          void fetch("/api/rita/session", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "end", sessionId: result.sessionId }),
            keepalive: true,
          }).catch(() => undefined);
        }
        return;
      }
      if (!response.ok || !result?.ok) throw ritaApiError(result, "Rita could not start.");
      if (!result.configured)
        throw new Error("economic_v2_config: Add both OpenAI and Deepgram keys first.");
      sessionId.current = String(result.sessionId);
      setPremiumVoice(result.allowance?.premiumVoice !== false);
      setStatus("Connecting Deepgram Nova-3…");
      const deepgramResponse = await fetch("/api/rita/deepgram-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const deepgram = await readRitaPayload<
        { token?: string; expiresIn?: number } & RitaErrorPayload
      >(deepgramResponse);
      if (!deepgramResponse.ok || !deepgram?.token)
        throw ritaApiError(deepgram, "Deepgram token could not be created.");
      const { startRitaEconomicListening } = await loadEconomic();
      const controller = await startRitaEconomicListening({
        token: deepgram.token,
        accent: accentPreference,
        browserLocale: navigator.language || "",
        keyterms: ["RitaJet", ...learningRef.current.slice(-20).map((item) => item.term)],
        callbacks: {
          onReady: (connectedLanguage) => {
            if (epoch !== lessonEpoch.current) return;
            setStatus(`Deepgram Nova-3 listening · ${connectedLanguage}`);
          },
          onVolume: setInputLevel,
          onSpeechStart: () => {
            if (mutedRef.current || epoch !== lessonEpoch.current) return;
            stopSpeaking();
            turnAbort.current?.abort();
            setMood("listening");
            setStatus("Deepgram is listening…");
          },
          onInterim: (value) => {
            if (epoch !== lessonEpoch.current) return;
            if (value) setStatus(`Hearing: ${value.slice(0, 90)}`);
          },
          onFinal: (turn) => {
            if (mutedRef.current || epoch !== lessonEpoch.current) return;
            lastSpoken.current = turn.text;
            void processTurnRef.current({
              text: turn.text,
              transcriptLanguage: turn.language,
              durationMs: turn.durationMs,
              addUser: true,
            });
          },
          onError: (message) => {
            if (epoch !== lessonEpoch.current) return;
            setMood("ready");
            setStatus("Deepgram failed — no fallback was used");
            setError(message);
          },
        },
      });
      if (epoch !== lessonEpoch.current) {
        controller.stop();
        return;
      }
      economic.current = controller;
      setConnectedMode("economic_v2");
      setActive(true);
      activeRef.current = true;
      setMood("listening");
      setStatus("Rita is listening — start speaking");
    } catch (cause) {
      if (epoch !== lessonEpoch.current) return;
      economic.current?.stop();
      economic.current = null;
      pcmPlayer.current?.close();
      pcmPlayer.current = null;
      setConnectedMode(null);
      const failedId = sessionId.current;
      sessionId.current = null;
      if (failedId)
        void getToken()
          .then((authToken) =>
            fetch("/api/rita/session", {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ action: "end", sessionId: failedId }),
            }),
          )
          .catch(() => undefined);
      setMood("ready");
      setStatus("Ready to try again");
      setError(cause instanceof Error ? cause.message : "Microphone access was not available.");
    } finally {
      if (epoch === lessonEpoch.current) setStarting(false);
    }
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    economic.current?.mute(next);
    setMood(next ? "ready" : "listening");
    setStatus(next ? "Microphone muted" : "Rita is listening");
  };

  const sendText = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || processing) return;
    add("you", text);
    setDraft("");
    lastSpoken.current = text;
    void processTurn({ text, transcriptLanguage: dialect, addUser: false });
  };

  const selectedItems = learningItems.filter((item) => selectedIds.includes(item.id));
  const previewItems = panel === "german_lab" ? selectedItems.filter(isGermanItem) : selectedItems;
  const flashOptions = destinations.flashSubjects.map((subject) => ({
    id: subject.id,
    label: subject.parent_id
      ? `${destinations.flashSubjects.find((parent) => parent.id === subject.parent_id)?.name ?? "Subject"} › ${subject.name}`
      : subject.name,
  }));
  const germanOptions = destinations.germanSubtopics.map((subtopic) => ({
    id: subtopic.id,
    label: `${destinations.germanSubjects.find((subject) => subject.id === subtopic.subject_id)?.name ?? "German"} › ${subtopic.name}`,
  }));
  const destinationOptions = panel === "german_lab" ? germanOptions : flashOptions;

  if (!loading && !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#faf9f3] p-5 text-[#292821]">
        <div className="max-w-sm rounded-[28px] border border-[#e8e4d8] bg-[#fffef9] p-8 text-center shadow-[0_24px_70px_-48px_rgba(53,50,37,.55)]">
          <Bot className="mx-auto mb-4 text-[#62a832]" />
          <h1 className="font-display text-2xl font-extrabold">Sign in to talk with Rita</h1>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-[#66ae36] px-5 py-3 font-extrabold text-white shadow-[0_4px_0_#4b8f28]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f8f7f3] text-[#24221e]">
      <div className="grid h-full overflow-hidden bg-[#fdfcf9] md:grid-cols-[minmax(0,1.22fr)_minmax(380px,.78fr)]">
        <section className="order-1 flex min-h-0 flex-col bg-[#fdfcf9] md:order-1">
          <header className="border-b border-[#e9e5df] px-5 pb-3 pt-4 md:px-9 md:pb-4 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Leave Rita Live"
                  onClick={() => {
                    endSession();
                    navigate({ to: "/" });
                  }}
                  className="grid h-10 w-10 place-items-center rounded-xl text-[#807d73] transition hover:bg-[#f1effa] hover:text-[#6238d9]"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-2.5 text-lg md:text-xl">
                  <h1 className="font-display font-extrabold tracking-[-.04em]">RitaJet</h1>
                  <span className="h-5 w-px bg-[#d9d4cc]" />
                  <span className="font-medium text-[#514d48]">Live lesson</span>
                </div>
              </div>
              {isAdmin && (
                <Link
                  to="/admin/ai-keys"
                  aria-label="Open Rita API key settings"
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#e3dde9] bg-white px-3 text-sm font-extrabold text-[#6a47cf] transition hover:border-[#b9a1f4] hover:bg-[#f6f1ff]"
                >
                  <KeyRound size={16} />
                  <span>API keys</span>
                </Link>
              )}
            </div>
            <div className="mt-4 h-1 w-40 rounded-full bg-[#ebe6f8]">
              <div
                className="h-full rounded-full bg-[#7246e9]"
                style={{ width: active ? "100%" : "34%" }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-[#6553a1]" role="status">
              {connectedMode === "economic_v2"
                ? "متصل: Rita Economic v2 · Deepgram Nova-3 → GPT-4o mini → OpenAI PCM"
                : "Rita Economic v2 · ابدأ الدرس للاتصال · لا يوجد fallback قديم"}
            </p>
          </header>

          <div className="relative min-h-0 flex-1">
            <div
              ref={transcript}
              onScroll={handleTranscriptScroll}
              className="rita-live-transcript h-full space-y-8 overflow-y-auto px-7 py-9 md:px-14 md:py-12"
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={message.role === "you" ? "flex justify-end" : "flex"}
                >
                  <div className="max-w-[92%] md:max-w-[86%]">
                    <p
                      className={`font-[family:var(--font-grotesk)] text-xl leading-9 tracking-[-.015em] md:text-[22px] md:leading-10 ${message.role === "rita" ? "text-[#28252d]" : "text-right text-[#3478f6]"}`}
                    >
                      {message.text}
                    </p>
                    {message.correction && (
                      <p className="mt-3 font-[family:var(--font-grotesk)] text-sm leading-6 text-[#7257a8]">
                        <b>Note:</b> {message.correction}
                      </p>
                    )}
                    {!!message.learningIds?.length && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {message.learningIds.map((id) => {
                          const item = learningItems.find((entry) => entry.id === id);
                          if (!item) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => openWords([id])}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e0d8f5] bg-[#f7f3ff] px-3.5 py-2 text-left text-[13px] font-semibold text-[#493c69] transition hover:border-[#a890ec] hover:bg-[#eee7ff]"
                            >
                              <span className="truncate font-bold">{item.term}</span>
                              <span className="text-[#8b7aaa]">·</span>
                              <span className="truncate">{item.meaning}</span>
                              <ChevronRight size={13} className="shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {processing && (
                <div className="flex items-center gap-2 text-sm font-medium text-[#6e6878]">
                  <Loader2 size={16} className="animate-spin" /> Rita is thinking…
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                >
                  {error}
                </p>
              )}
              <div ref={messageEnd} />
            </div>
            {showJumpToLatest && (
              <button
                type="button"
                onClick={scrollToLatest}
                className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#2f253d] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#4a3373]"
              >
                <ArrowDown size={16} /> Latest
              </button>
            )}
          </div>

          <form
            onSubmit={sendText}
            className="border-t border-[#e9e5df] bg-[#fdfcf9] px-4 py-3 md:px-9 md:py-4"
          >
            {needsTapToPlay && hasReplay && (
              <button
                type="button"
                onClick={() => void replaySpeech()}
                className="mx-auto mb-3 flex w-full max-w-2xl items-center justify-center gap-2 rounded-2xl bg-[#7246e9] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#6135d1]"
              >
                <Play size={17} fill="currentColor" /> Play Rita’s voice
              </button>
            )}
            <div className="mx-auto max-w-2xl rounded-[24px] border border-[#e3ddd6] bg-white px-3 pb-2 pt-2.5 shadow-[0_10px_28px_-24px_rgba(53,50,37,.45)] focus-within:border-[#bca8ed]">
              <textarea
                value={draft}
                disabled={processing}
                rows={2}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask Rita anything…"
                className="max-h-28 min-h-12 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-[#aaa69b] disabled:bg-transparent"
              />
              <div className="flex items-center justify-between gap-2 border-t border-[#f0ece8] pt-2">
                <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={active ? toggleMute : beginSession}
                    disabled={starting || (!active && configured === false)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2ddd4] px-3 py-1.5 text-xs font-bold text-[#413b39] transition hover:bg-[#f6f3ee] disabled:opacity-45"
                  >
                    {starting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : muted ? (
                      <MicOff size={14} />
                    ) : (
                      <Mic size={14} />
                    )}
                    {starting ? "Connecting" : active ? (muted ? "Unmute" : "Mute") : "Record"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openWords()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2ddd4] px-3 py-1.5 text-xs font-bold text-[#413b39] transition hover:bg-[#f6f3ee]"
                  >
                    <BookOpen size={14} /> Words{" "}
                    {learningItems.length ? `(${learningItems.length})` : ""}
                  </button>
                  {hasReplay && (
                    <button
                      type="button"
                      onClick={() => void replaySpeech()}
                      aria-label="Replay Rita’s last voice reply"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2ddd4] px-3 py-1.5 text-xs font-bold text-[#413b39] transition hover:bg-[#f6f3ee]"
                    >
                      <RotateCcw size={14} /> Replay
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openSave("flashcards")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2ddd4] px-3 py-1.5 text-xs font-bold text-[#413b39] transition hover:bg-[#f6f3ee]"
                  >
                    <Layers size={14} /> Flashcards
                  </button>
                  <button
                    type="button"
                    onClick={() => void openSave("german_lab")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2ddd4] px-3 py-1.5 text-xs font-bold text-[#413b39] transition hover:bg-[#f6f3ee]"
                  >
                    🇩🇪 German Lab
                  </button>
                </div>
                <button
                  disabled={!draft.trim() || processing}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#9873ed] text-white transition hover:bg-[#7246e9] disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
            {(learningNotice || active) && (
              <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between gap-3 text-xs">
                <span role="status" className="text-[#6f6480]">
                  {learningNotice || status}
                </span>
                {active && (
                  <button
                    type="button"
                    onClick={endSession}
                    className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#a33d52] hover:underline"
                  >
                    <PhoneOff size={13} /> End lesson
                  </button>
                )}
              </div>
            )}
          </form>
        </section>

        <section className="order-2 min-h-[180px] md:order-2 md:min-h-0">
          <RitaStage
            mood={mood}
            active={active}
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            caption={caption}
            dialect={dialect}
            accentPreference={accentPreference}
            onAccentChange={setAccentPreference}
            latencyMs={isAdmin ? lastVoiceLatencyMs : null}
            timingDetails={
              isAdmin
                ? [
                    ["STT", lastVoiceTimings.stt],
                    ["AI", lastVoiceTimings.answer],
                    ["Voice", lastVoiceTimings.speech],
                    ["DB", lastVoiceTimings.usage ?? lastVoiceTimings.claim],
                  ]
                    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
                    .map(([label, duration]) => `${label} ${Math.round(duration)}ms`)
                    .join(" · ")
                : undefined
            }
          />
        </section>
      </div>
      {panel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#20182d]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "words"
                ? "Words from this lesson"
                : `Save to ${panel === "flashcards" ? "flashcards" : "German Lab"}`
            }
            className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[#fffefa] shadow-2xl sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#ece8e4] px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8b6bd5]">
                  Rita’s lesson
                </p>
                <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#2b2631]">
                  {panel === "words"
                    ? "Words we learned"
                    : panel === "flashcards"
                      ? "Make flashcards"
                      : "Save to German Lab"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close learning panel"
                onClick={() => {
                  panelRef.current = null;
                  setPanel(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-full text-[#756d78] hover:bg-[#f1edf7]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {!learningItems.length ? (
                <p className="rounded-2xl bg-[#f7f4fc] p-5 text-sm leading-6 text-[#61596e]">
                  Ask Rita about a word or sentence first. She’ll collect the useful ones here
                  during this lesson.
                </p>
              ) : panel === "words" ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#716879]">
                    Check the items you want, and correct anything before saving.
                  </p>
                  {learningItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#e8e2ec] bg-white p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.term}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          className="mt-2 h-4 w-4 accent-[#7246e9]"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <input
                            aria-label="Word or sentence"
                            value={item.term}
                            maxLength={180}
                            onChange={(event) => editLearning(item.id, "term", event.target.value)}
                            className="w-full border-b border-[#eee8f3] bg-transparent pb-1 text-base font-bold outline-none focus:border-[#a68ae9]"
                          />
                          <input
                            aria-label="Meaning"
                            value={item.meaning}
                            maxLength={280}
                            onChange={(event) =>
                              editLearning(item.id, "meaning", event.target.value)
                            }
                            className="w-full bg-transparent text-sm text-[#655c6b] outline-none"
                          />
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9b91a7]">
                            {item.language} · {item.kind}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${item.term}`}
                          onClick={() => removeLearning(item.id)}
                          className="text-[#a59cab] hover:text-rose-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-[#f7f4fc] p-4">
                    <p className="text-xs font-bold uppercase tracking-[.13em] text-[#7758bf]">
                      Ready to save · {previewItems.length}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {previewItems.slice(0, 12).map((item) => (
                        <span
                          key={item.id}
                          className="max-w-full truncate rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#514567]"
                        >
                          {item.term}
                        </span>
                      ))}
                      {previewItems.length > 12 && (
                        <span className="px-1 py-1 text-xs text-[#7b7184]">
                          +{previewItems.length - 12} more
                        </span>
                      )}
                    </div>
                    {panel === "german_lab" && selectedItems.length > previewItems.length && (
                      <p className="mt-2 text-xs text-[#776e80]">
                        Non-German items won’t be added to German Lab.
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="rita-destination"
                      className="mb-2 block text-sm font-bold text-[#3d3548]"
                    >
                      {panel === "flashcards"
                        ? "Choose a subject or sub-subject"
                        : "Choose a German subject and sub-subject"}
                    </label>
                    <select
                      id="rita-destination"
                      value={destinationId}
                      onChange={(event) => setDestinationId(event.target.value)}
                      className="w-full rounded-xl border border-[#ded7e5] bg-white px-3 py-3 text-sm outline-none focus:border-[#a88ae9]"
                    >
                      <option value="">Select where to save</option>
                      {destinationOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {!destinationOptions.length && (
                      <p className="mt-2 text-xs text-[#80758a]">
                        No personal destinations yet. Create one below.
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#544a60]">
                    <input
                      type="checkbox"
                      checked={rememberChoice}
                      onChange={(event) => setRememberChoice(event.target.checked)}
                      className="h-4 w-4 accent-[#7246e9]"
                    />
                    Use this destination for the rest of this lesson
                  </label>

                  <div className="border-t border-[#eee9f0] pt-4">
                    {panel === "flashcards" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCreating("flash");
                            setFlashParentId("");
                            setNewName("");
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6a47c1]"
                        >
                          <Plus size={14} /> New subject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCreating("flash");
                            setFlashParentId(destinationId);
                            setNewName("");
                          }}
                          disabled={!destinationId}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6a47c1] disabled:opacity-40"
                        >
                          <Plus size={14} /> New sub-subject
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <select
                          aria-label="Parent German subject"
                          value={germanSubjectId}
                          onChange={(event) => setGermanSubjectId(event.target.value)}
                          className="w-full rounded-xl border border-[#ded7e5] bg-white px-3 py-2.5 text-sm"
                        >
                          <option value="">Choose a parent subject for a new sub-subject</option>
                          {destinations.germanSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setCreating("german_subject");
                              setNewName("");
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#6a47c1]"
                          >
                            <Plus size={14} /> New German subject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreating("german_subtopic");
                              setNewName("");
                            }}
                            disabled={!germanSubjectId}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#6a47c1] disabled:opacity-40"
                          >
                            <Plus size={14} /> New sub-subject
                          </button>
                        </div>
                      </div>
                    )}
                    {creating && (
                      <div className="mt-3 flex gap-2">
                        <input
                          value={newName}
                          onChange={(event) => setNewName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void createDestination();
                            }
                          }}
                          placeholder={
                            creating === "german_subtopic" || flashParentId
                              ? "Sub-subject name"
                              : "Subject name"
                          }
                          maxLength={80}
                          className="min-w-0 flex-1 rounded-xl border border-[#ded7e5] px-3 py-2 text-sm outline-none focus:border-[#a88ae9]"
                        />
                        <button
                          type="button"
                          onClick={() => void createDestination()}
                          disabled={saving || !newName.trim()}
                          className="rounded-xl bg-[#ece4ff] px-3 py-2 text-xs font-bold text-[#5935bd] disabled:opacity-40"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreating(null)}
                          aria-label="Cancel creation"
                          className="px-1 text-[#8a8191]"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {learningNotice && (
                <p
                  role="status"
                  className="mt-4 rounded-xl bg-[#f4edff] px-3 py-2 text-sm text-[#6846a9]"
                >
                  {learningNotice}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ece8e4] px-5 py-4 sm:px-7">
              {panel === "words" ? (
                <>
                  <span className="text-xs text-[#83798c]">{selectedIds.length} selected</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openSave("flashcards", selectedIds)}
                      disabled={!selectedIds.length}
                      className="rounded-full border border-[#dcd4eb] px-4 py-2 text-xs font-bold text-[#5a4b71] disabled:opacity-40"
                    >
                      Flashcards
                    </button>
                    <button
                      type="button"
                      onClick={() => void openSave("german_lab", selectedIds)}
                      disabled={!selectedItems.some(isGermanItem)}
                      className="rounded-full bg-[#7246e9] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                    >
                      German Lab
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openWords(selectedIds)}
                    className="text-xs font-bold text-[#746780] hover:underline"
                  >
                    ← Edit items
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void saveLearning(panel, destinationId, selectedIds, rememberChoice)
                    }
                    disabled={saving || !destinationId || !previewItems.length}
                    className="inline-flex items-center gap-2 rounded-full bg-[#7246e9] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6036cf] disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {saving
                      ? "Saving…"
                      : `Save ${previewItems.length} ${previewItems.length === 1 ? "item" : "items"}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Bot,
  ChevronDown,
  Languages,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Send,
  X,
} from "lucide-react";
import { RitaStage, type RitaMood } from "@/components/rita-live/RitaStage";
import { startRitaVad, type RitaVadController } from "@/lib/rita-vad";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Persona = "kind" | "direct" | "playful" | "strict";
type Message = {
  id: string;
  role: "rita" | "you";
  text: string;
  correction?: string;
};
type TurnResult = {
  turnId: string;
  transcript: string;
  reply: string;
  detectedLanguage: string;
  detectedDialect: string;
  confidence: number;
  correction: string;
  emotion: string;
  lessonAction: string;
  premiumVoice: boolean;
};

const personaCopy: Record<Persona, { label: string; detail: string }> = {
  kind: { label: "Kind teacher", detail: "Warm, patient and encouraging" },
  direct: { label: "Direct teacher", detail: "Clear feedback without sugar-coating" },
  playful: { label: "Playful teacher", detail: "Light, clever and encouraging" },
  strict: { label: "Strict teacher", detail: "Focused, structured and respectful" },
};

const languages = [
  { value: "automatic", label: "Automatic — match how I speak" },
  { value: "ar", label: "Arabic" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
  { value: "tr", label: "Turkish" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ru", label: "Russian" },
  { value: "hi", label: "Hindi" },
  { value: "ur", label: "Urdu" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
];

const accentExamples = [
  "Egyptian Arabic",
  "Jordanian Arabic",
  "Iraqi Arabic",
  "Gulf Arabic",
  "Moroccan Arabic",
  "British English",
  "American English",
  "Indian English",
  "Australian English",
  "Mexican Spanish",
  "Caribbean Spanish",
  "Brazilian Portuguese",
  "Canadian French",
];

export const Route = createFileRoute("/rita-live")({
  head: () => ({
    meta: [{ title: "Talk with Rita — RitaJet" }, { name: "robots", content: "noindex" }],
  }),
  component: RitaLivePage,
});

function RitaLivePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [persona, setPersona] = useState<Persona>("kind");
  const [language, setLanguage] = useState("automatic");
  const [dialect, setDialect] = useState("unknown");
  const [accentPreference, setAccentPreference] = useState("");
  const [mood, setMood] = useState<RitaMood>("ready");
  const [status, setStatus] = useState("Preparing Rita…");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "rita",
      text: "Hi, I’m Rita. What would you like to practise?",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [premiumVoice, setPremiumVoice] = useState(true);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const vad = useRef<RitaVadController | null>(null);
  const sessionId = useRef<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const turnAbort = useRef<AbortController | null>(null);
  const outputContext = useRef<AudioContext | null>(null);
  const outputAnalyser = useRef<AnalyserNode | null>(null);
  const outputSource = useRef<MediaElementAudioSourceNode | null>(null);
  const outputFrame = useRef<number | null>(null);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const transcript = useRef<HTMLDivElement | null>(null);
  const stickToLatest = useRef(true);
  const messagesRef = useRef(messages);
  const activeRef = useRef(active);
  const processingRef = useRef(processing);
  const mutedRef = useRef(muted);
  const settingsRef = useRef({ persona, language, dialect, accentPreference });
  const processTurnRef = useRef<(args: { blob?: Blob; text?: string }) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
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
  }, [persona, language, dialect, accentPreference]);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Please sign in before talking with Rita.");
    return token;
  }, []);

  const add = useCallback((role: Message["role"], text: string, correction?: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((all) => [
      ...all,
      { id: `${Date.now()}-${Math.random()}`, role, text: clean, correction: correction?.trim() },
    ]);
  }, []);

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
    const analyser = outputAnalyser.current;
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let power = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        power += centered * centered;
      }
      setOutputLevel(Math.min(1, Math.sqrt(power / samples.length) * 5.5));
      outputFrame.current = requestAnimationFrame(tick);
    };
    stopOutputMeter();
    tick();
  }, [stopOutputMeter]);

  const stopSpeaking = useCallback(() => {
    stopOutputMeter();
    window.speechSynthesis?.cancel();
    if (audio.current) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    vad.current?.setOutputSpeaking(false);
  }, [stopOutputMeter]);

  const speakWithDevice = useCallback(
    (result: TurnResult) => {
      if (!("speechSynthesis" in window)) {
        setMood(activeRef.current ? "listening" : "ready");
        setStatus("Reply ready in the chat");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(result.reply);
      const regionalCode = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(result.detectedDialect)
        ? result.detectedDialect
        : "";
      const code = regionalCode || result.detectedLanguage || "en";
      utterance.lang = code;
      const matchingVoice = window.speechSynthesis
        .getVoices()
        .find((item) => item.lang.toLowerCase().startsWith(code.toLowerCase()));
      if (matchingVoice) utterance.voice = matchingVoice;
      utterance.rate = 1.02;
      utterance.pitch = 1.03;
      utterance.onstart = () => {
        vad.current?.setOutputSpeaking(true);
        setMood("talking");
        setStatus("Rita is speaking — you can interrupt anytime");
        const pulse = () => {
          setOutputLevel(0.2 + Math.random() * 0.48);
          outputFrame.current = requestAnimationFrame(pulse);
        };
        pulse();
      };
      utterance.onend = () => {
        stopOutputMeter();
        vad.current?.setOutputSpeaking(false);
        setMood(activeRef.current ? "listening" : "ready");
        setStatus(activeRef.current ? "Rita is listening" : "Reply ready");
      };
      utterance.onerror = utterance.onend;
      window.speechSynthesis.speak(utterance);
    },
    [stopOutputMeter],
  );

  const speakPremium = useCallback(
    async (result: TurnResult, token: string) => {
      if (!result.premiumVoice) {
        setPremiumVoice(false);
        speakWithDevice(result);
        return;
      }
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
        });
        if (!response.ok) throw new Error("Premium voice unavailable");
        const blob = await response.blob();
        if (!activeRef.current || !audio.current) return;
        stopSpeaking();
        const url = URL.createObjectURL(blob);
        audioUrl.current = url;
        audio.current.src = url;
        if (!outputContext.current) {
          const Context =
            window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (Context) outputContext.current = new Context();
        }
        if (outputContext.current && !outputSource.current) {
          outputSource.current = outputContext.current.createMediaElementSource(audio.current);
          outputAnalyser.current = outputContext.current.createAnalyser();
          outputAnalyser.current.fftSize = 256;
          outputSource.current.connect(outputAnalyser.current);
          outputAnalyser.current.connect(outputContext.current.destination);
        }
        await outputContext.current?.resume();
        audio.current.onplay = () => {
          vad.current?.setOutputSpeaking(true);
          setMood("talking");
          setStatus("Rita is speaking — you can interrupt anytime");
          startOutputMeter();
        };
        audio.current.onended = () => {
          stopOutputMeter();
          vad.current?.setOutputSpeaking(false);
          setMood(activeRef.current ? "listening" : "ready");
          setStatus(activeRef.current ? "Rita is listening" : "Lesson paused");
        };
        await audio.current.play();
        setPremiumVoice(true);
      } catch {
        speakWithDevice(result);
      }
    },
    [speakWithDevice, startOutputMeter, stopOutputMeter, stopSpeaking],
  );

  const processTurn = useCallback(
    async ({ blob, text }: { blob?: Blob; text?: string }) => {
      if (!blob && !text?.trim()) return;
      if (blob && mutedRef.current) return;
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
        const current = settingsRef.current;
        const form = new FormData();
        if (blob) form.append("audio", blob, "rita-turn.wav");
        if (text) form.append("text", text.trim());
        form.append("sessionId", sessionId.current ?? "");
        form.append("personality", current.persona);
        form.append("language", current.language);
        form.append("accentHint", current.dialect);
        form.append("accentPreference", current.accentPreference);
        form.append("browserLocale", navigator.language || "");
        form.append(
          "history",
          JSON.stringify(
            messagesRef.current.slice(-8).map((item) => ({
              role: item.role === "rita" ? "assistant" : "user",
              content: item.text,
            })),
          ),
        );
        const response = await fetch("/api/rita/turn", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = await response
            .json()
            .catch(async () => ({ error: await response.text() }));
          throw new Error(String(detail?.error ?? "Rita could not answer right now."));
        }
        const result = (await response.json()) as TurnResult;
        if (blob && result.transcript) add("you", result.transcript);
        add("rita", result.reply, result.correction);
        setCaption(result.reply);
        if (current.accentPreference.trim()) {
          setDialect(current.accentPreference.trim());
        } else if (result.confidence >= 0.72) {
          setDialect(result.detectedDialect || "standard");
        }
        setPremiumVoice(result.premiumVoice);
        if (activeRef.current) await speakPremium(result, token);
        else {
          setMood("ready");
          setStatus("Reply ready");
        }
      } catch (cause) {
        if ((cause as Error)?.name === "AbortError") return;
        setMood(activeRef.current ? "listening" : "ready");
        setStatus(activeRef.current ? "Rita is listening" : "Ready to start");
        setError(cause instanceof Error ? cause.message : "Rita could not answer right now.");
      } finally {
        if (turnAbort.current === controller) turnAbort.current = null;
        setProcessing(false);
        processingRef.current = false;
      }
    },
    [add, getToken, speakPremium],
  );
  processTurnRef.current = processTurn;

  const endSession = useCallback(() => {
    turnAbort.current?.abort();
    turnAbort.current = null;
    vad.current?.stop();
    vad.current = null;
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
    activeRef.current = false;
    setStarting(false);
    setProcessing(false);
    processingRef.current = false;
    setMuted(false);
    setInputLevel(0);
    setMood("ready");
    setStatus("Lesson ended");
  }, [getToken, stopSpeaking]);

  useEffect(() => () => endSession(), [endSession]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getToken()
      .then((token) =>
        fetch("/api/rita/session", { headers: { Authorization: `Bearer ${token}` } }),
      )
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (cancelled) return;
        setConfigured(Boolean(result?.configured));
        setPremiumVoice(result?.allowance?.premiumVoice !== false);
        setStatus(result?.configured ? "Ready to start" : "Rita needs an OpenAI key");
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
    setStarting(true);
    setError(null);
    setStatus("Requesting microphone access…");
    setMood("thinking");
    try {
      const controller = await startRitaVad({
        onVolume: setInputLevel,
        onSpeechStart: () => {
          if (mutedRef.current) return;
          stopSpeaking();
          turnAbort.current?.abort();
          setMood("listening");
          setStatus("Listening…");
        },
        onSpeechEnd: (blob) => {
          if (!mutedRef.current) void processTurnRef.current({ blob });
        },
        onError: (cause) => setError(cause.message),
      });
      vad.current = controller;
      const token = await getToken();
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
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Rita could not start.");
      if (!result.configured) throw new Error("Add a new OpenAI key in Admin → AI keys first.");
      sessionId.current = String(result.sessionId);
      setPremiumVoice(result.allowance?.premiumVoice !== false);
      setActive(true);
      activeRef.current = true;
      setMood("listening");
      setStatus("Rita is listening — start speaking");
    } catch (cause) {
      vad.current?.stop();
      vad.current = null;
      setMood("ready");
      setStatus("Ready to try again");
      setError(cause instanceof Error ? cause.message : "Microphone access was not available.");
    } finally {
      setStarting(false);
    }
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    vad.current?.stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMood(next ? "ready" : "listening");
    setStatus(next ? "Microphone muted" : "Rita is listening");
  };

  const sendText = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || processing) return;
    add("you", text);
    setDraft("");
    void processTurn({ text });
  };

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
      <audio ref={audio} playsInline preload="none" />
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
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e3dde9] bg-white px-3.5 py-2 text-sm font-semibold text-[#514b5d] transition hover:border-[#b9a1f4] hover:bg-[#f6f1ff]"
              >
                <span className="hidden sm:inline">Settings</span>
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="mt-4 h-1 w-40 rounded-full bg-[#ebe6f8]">
              <div
                className="h-full rounded-full bg-[#7246e9]"
                style={{ width: active ? "100%" : "34%" }}
              />
            </div>
          </header>

          {settingsOpen && (
            <div className="border-b border-[#e9e5df] bg-[#faf8ff] p-4 md:p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(personaCopy) as Persona[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setPersona(item)}
                    className={`rounded-2xl border p-3 text-left text-sm transition-colors ${persona === item ? "border-[#bba4fa] bg-[#eee7ff] text-[#4e2ab5]" : "border-[#e7e1ee] bg-white hover:border-[#c8b7f5]"}`}
                  >
                    <b>{personaCopy[item].label}</b>
                    <span className="mt-1 block text-xs text-[#858177]">
                      {personaCopy[item].detail}
                    </span>
                  </button>
                ))}
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
                <Languages size={16} />
                <select
                  value={language}
                  onChange={(event) => {
                    setLanguage(event.target.value);
                    setDialect("unknown");
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-[#e5deeb] bg-white p-2.5 focus:border-[#9c7deb]"
                >
                  {languages.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-semibold text-[#4b4942]">
                Accent or region <span className="font-normal text-[#969187]">(optional)</span>
                <input
                  value={accentPreference}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAccentPreference(value);
                    setDialect(value.trim() || "unknown");
                  }}
                  list="rita-accent-examples"
                  placeholder="Automatic, or type any accent — e.g. Mexican Spanish"
                  className="mt-2 w-full rounded-xl border border-[#e5deeb] bg-white p-2.5 font-normal outline-none focus:border-[#9c7deb]"
                />
                <datalist id="rita-accent-examples">
                  {accentExamples.map((accent) => (
                    <option key={accent} value={accent} />
                  ))}
                </datalist>
              </label>
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            <div
              ref={transcript}
              onScroll={handleTranscriptScroll}
              className="rita-live-transcript h-full space-y-7 overflow-y-auto px-5 py-7 md:px-11 md:py-10"
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex gap-3 ${message.role === "you" ? "justify-end" : ""}`}
                >
                  {message.role === "rita" && (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eee7ff] text-sm font-bold text-[#6238d9]">
                      R
                    </span>
                  )}
                  <div className="max-w-[84%]">
                    <div
                      className={`rounded-[20px] px-5 py-4 text-base leading-7 md:text-[17px] ${message.role === "rita" ? "bg-[#f3f0fb] text-[#302b37]" : "bg-[#7044df] text-white shadow-[0_3px_0_#5532b1]"}`}
                    >
                      {message.text}
                    </div>
                    {message.correction && (
                      <div className="mt-2 rounded-xl border border-[#ded1ff] bg-[#faf7ff] px-3 py-2 text-xs leading-relaxed text-[#634a94]">
                        <b>Quick correction:</b> {message.correction}
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
            className="border-t border-[#e9e5df] bg-[#fdfcf9] px-5 py-4 md:px-9 md:py-5"
          >
            <div className="rounded-[22px] border border-[#e4dfd5] bg-white p-2 shadow-[0_12px_28px_-24px_rgba(53,50,37,.48)]">
              <div className="flex gap-2">
                <input
                  value={draft}
                  disabled={processing}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask Rita anything…"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-[#aaa69b] disabled:bg-transparent"
                />
                <button
                  disabled={!draft.trim() || processing}
                  className="grid h-11 w-11 place-items-center rounded-full bg-[#cdbcf8] text-white transition hover:bg-[#7246e9] disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            {!active ? (
              <button
                type="button"
                disabled={starting || configured === false}
                onClick={beginSession}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7246e9] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#6036cf] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {starting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {starting ? "Connecting…" : "Start lesson"}
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${muted ? "bg-amber-100 text-amber-800" : "bg-[#eee7ff] text-[#5935bd]"}`}
                >
                  {muted ? <MicOff size={17} /> : <Mic size={17} />}
                  {muted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  onClick={endSession}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white"
                >
                  <PhoneOff size={17} /> End lesson
                </button>
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
          />
        </section>
      </div>
    </main>
  );
}

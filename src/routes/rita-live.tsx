import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Languages,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Send,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { RitaStage, type RitaMood } from "@/components/rita-live/RitaStage";
import { startRitaVad, type RitaVadController } from "@/lib/rita-vad.client";
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
      text: "Hi, I’m Rita. Start your lesson once, then just speak naturally — I’ll listen and answer automatically.",
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
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, processing]);

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
    <main className="min-h-screen bg-[#f2efe6] p-2 text-[#292821] md:p-5">
      <audio ref={audio} playsInline preload="none" />
      <div className="mx-auto grid min-h-[calc(100vh-1rem)] max-w-[1680px] overflow-hidden rounded-[24px] border border-[#dfdbcf] bg-[#fffef9] shadow-[0_32px_90px_-54px_rgba(38,36,28,.62)] md:min-h-[calc(100vh-2.5rem)] md:grid-cols-[minmax(0,1.16fr)_minmax(430px,.84fr)] md:rounded-[34px]">
        <section className="order-2 flex min-h-[58vh] flex-col bg-[#fffef9] md:order-1 md:min-h-0">
          <header className="border-b border-[#ece8dc] px-4 py-4 md:px-7 md:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Leave Rita Live"
                  onClick={() => {
                    endSession();
                    navigate({ to: "/" });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full text-[#9a978d] transition hover:bg-[#f1efe7] hover:text-[#292821]"
                >
                  <X size={18} />
                </button>
                <div>
                  <p className="text-[10px] font-black tracking-[.17em] text-[#6b9f36]">
                    YOUR PRIVATE TUTOR
                  </p>
                  <h1 className="font-display text-xl font-extrabold tracking-[-.02em] md:text-2xl">
                    Talk with Rita
                  </h1>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#e8e4d8] bg-[#fbfaf5] px-3 py-2 text-xs font-bold text-[#5f5c53] shadow-sm transition hover:bg-white"
              >
                <Sparkles size={14} /> <span className="hidden sm:inline">Rita’s style</span>
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#70b840] shadow-[0_0_12px_#70b840]" : configured ? "bg-[#d3a25a]" : "bg-[#c4c0b7]"}`}
              />
              <p className="text-xs font-semibold text-[#777369]">{status}</p>
              <span className="ml-auto rounded-full bg-[#f2f0e8] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#777369]">
                {premiumVoice ? "Premium voice" : "Standard voice"}
              </span>
            </div>
          </header>

          {settingsOpen && (
            <div className="border-b border-[#ece8dc] bg-[#fbfaf5] p-4 md:p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(personaCopy) as Persona[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setPersona(item)}
                    className={`rounded-2xl border p-3 text-left text-sm transition-colors ${persona === item ? "border-[#8bc65d] bg-[#f1f8e9] text-[#335b1b]" : "border-[#e8e4d8] bg-white hover:border-[#cdddbd]"}`}
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
                  className="min-w-0 flex-1 rounded-xl border border-[#e8e4d8] bg-white p-2.5"
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
                  className="mt-2 w-full rounded-xl border border-[#e8e4d8] bg-white p-2.5 font-normal outline-none focus:border-[#8bc65d]"
                />
                <datalist id="rita-accent-examples">
                  {accentExamples.map((accent) => (
                    <option key={accent} value={accent} />
                  ))}
                </datalist>
              </label>
              <p className="mt-2 text-xs leading-relaxed text-[#858177]">
                Automatic mode follows your language, regional vocabulary, slang, formality, and
                code-switching. Type a region when you want an exact accent instead of automatic
                matching.
              </p>
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto p-5 md:p-8">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex gap-3 ${message.role === "you" ? "justify-end" : ""}`}
              >
                {message.role === "rita" && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e8f4dc] text-[#4e8628]">
                    <Sparkles size={15} />
                  </span>
                )}
                <div className="max-w-[84%]">
                  <div
                    className={`rounded-[18px] px-4 py-3 text-[15px] leading-relaxed ${message.role === "rita" ? "bg-[#f5f3eb] text-[#36342e]" : "bg-[#6eaf3d] text-white shadow-[0_4px_0_#57952d]"}`}
                  >
                    {message.text}
                  </div>
                  {message.correction && (
                    <div className="mt-2 rounded-xl border border-[#edd9bd] bg-[#fff8eb] px-3 py-2 text-xs leading-relaxed text-[#805b2f]">
                      <b>Quick correction:</b> {message.correction}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {processing && (
              <div className="flex items-center gap-2 text-sm text-[#858177]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf6e4] text-[#5d9f30]">
                  <Volume2 size={15} />
                </span>
                <Loader2 size={15} className="animate-spin" /> Rita is preparing your answer…
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

          <form onSubmit={sendText} className="border-t border-[#ece8dc] bg-[#fffef9] p-4 md:p-5">
            <div className="rounded-[18px] border border-[#e7e3d8] bg-white p-2 shadow-[0_10px_26px_-22px_rgba(53,50,37,.75)]">
              <div className="flex gap-2">
                <input
                  value={draft}
                  disabled={processing}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask Rita anything…"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-[#aaa69b] disabled:bg-transparent"
                />
                <button
                  disabled={!draft.trim() || processing}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-[#70b840] text-white shadow-[0_3px_0_#57952d] transition hover:bg-[#63a735] disabled:opacity-40"
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
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#70b840] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_0_#57952d] transition hover:bg-[#63a735] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {starting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {starting ? "Connecting Rita…" : "Start hands-free lesson"}
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition ${muted ? "bg-amber-100 text-amber-800" : "bg-[#edf5e6] text-[#4e842b]"}`}
                >
                  {muted ? <MicOff size={17} /> : <Mic size={17} />}
                  {muted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  onClick={endSession}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_#a91d3d]"
                >
                  <PhoneOff size={17} /> End lesson
                </button>
              </div>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-[#959187]">
              One start per lesson. After that, Rita detects when you finish speaking and answers
              automatically. Silence does not use paid voice time.
            </p>
          </form>
        </section>

        <section className="order-1 min-h-[48vh] md:order-2 md:min-h-0">
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

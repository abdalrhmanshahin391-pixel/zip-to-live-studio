import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  CircleStop,
  Languages,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { RitaStage, type RitaMood } from "@/components/rita-live/RitaStage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Persona = "kind" | "direct" | "playful" | "strict";
type ServiceMode = "checking" | "demo" | "live";
type Message = { id: string; role: "rita" | "you"; text: string };

const personaCopy: Record<Persona, { label: string; detail: string }> = {
  kind: { label: "Kind teacher", detail: "Warm, patient and encouraging" },
  direct: { label: "Direct teacher", detail: "Clear feedback, no sugar-coating" },
  playful: { label: "Playful teacher", detail: "Light, clever and encouraging" },
  strict: { label: "Strict teacher", detail: "Focused, structured and respectful" },
};

const languages = ["Automatic — Rita listens first", "Arabic", "English", "German", "Turkish"];

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
  const [language, setLanguage] = useState(languages[0]);
  const [mode, setMode] = useState<ServiceMode>("checking");
  const [mood, setMood] = useState<RitaMood>("ready");
  const [status, setStatus] = useState("Checking Rita's voice…");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "rita",
      text: "Hi, I’m Rita. Press the microphone and tell me what you want to practise.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  const peer = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const liveBuffers = useRef({ you: "", rita: "" });
  const transcriptTimers = useRef<{ you?: number; rita?: number }>({});
  const messageEnd = useRef<HTMLDivElement | null>(null);

  const add = useCallback((role: Message["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((all) => [...all, { id: `${Date.now()}-${Math.random()}`, role, text: clean }]);
  }, []);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const stopMedia = useCallback(() => {
    recorder.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setRecording(false);
  }, []);

  const endSession = useCallback(() => {
    try {
      if (channel.current?.readyState === "open")
        channel.current.send(JSON.stringify({ type: "session.close" }));
    } catch {
      // The connection may already be closing.
    }
    channel.current?.close();
    channel.current = null;
    peer.current?.close();
    peer.current = null;
    stopMedia();
    if (audio.current) audio.current.srcObject = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    Object.values(transcriptTimers.current).forEach((timer) => timer && window.clearTimeout(timer));
    liveBuffers.current = { you: "", rita: "" };
    setActive(false);
    setBusy(false);
    setMood("ready");
    setStatus("Session ended");
  }, [stopMedia]);

  useEffect(() => () => endSession(), [endSession]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/rita/live", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = response.ok ? await response.json() : null;
        if (cancelled) return;
        const next: ServiceMode = result?.mode === "live" ? "live" : "demo";
        setMode(next);
        setStatus(next === "live" ? "Live voice is ready" : "Demo voice is ready");
      } catch {
        if (!cancelled) {
          setMode("demo");
          setStatus("Demo voice is ready");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const flushLiveTranscript = useCallback(
    (role: "you" | "rita") => {
      const text = liveBuffers.current[role];
      liveBuffers.current[role] = "";
      if (text.trim()) add(role, text);
      if (role === "rita") {
        setMood("listening");
        setStatus("Rita is listening");
      }
    },
    [add],
  );

  const appendLiveTranscript = useCallback(
    (role: "you" | "rita", delta: string) => {
      liveBuffers.current[role] += delta;
      const oldTimer = transcriptTimers.current[role];
      if (oldTimer) window.clearTimeout(oldTimer);
      transcriptTimers.current[role] = window.setTimeout(() => flushLiveTranscript(role), 850);
    },
    [flushLiveTranscript],
  );

  async function waitForIce(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve) => {
      const done = () => {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      };
      const check = () => pc.iceGatheringState === "complete" && done();
      pc.addEventListener("icegatheringstatechange", check);
      window.setTimeout(done, 2_500);
    });
  }

  const beginLive = async () => {
    if (peer.current || busy) return;
    setError(null);
    setBusy(true);
    setStatus("Asking for microphone access…");
    setMood("thinking");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in before starting a live lesson.");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = media;
      const pc = new RTCPeerConnection();
      peer.current = pc;
      pc.ontrack = (event) => {
        if (audio.current) {
          audio.current.srcObject = event.streams[0];
          void audio.current.play();
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          setError("The live connection was interrupted. Please reconnect.");
          endSession();
        }
      };
      media.getTracks().forEach((track) => pc.addTrack(track, media));

      const dc = pc.createDataChannel("oai-events");
      channel.current = dc;
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "session.started") {
            setBusy(false);
            setActive(true);
            setStatus("Rita is listening");
            setMood("listening");
          } else if (data.type === "session.output_transcript.delta") {
            setMood("talking");
            setStatus("Rita is speaking");
            appendLiveTranscript("rita", String(data.delta ?? ""));
          } else if (data.type === "session.input_transcript.delta") {
            setMood("listening");
            appendLiveTranscript("you", String(data.delta ?? ""));
          } else if (data.type === "error") {
            setError("Rita had a live connection problem. Please reconnect.");
          }
        } catch {
          // Ignore non-JSON transport events.
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Could not prepare the live connection.");
      const response = await fetch("/api/rita/live", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sdp, personality: persona, language }),
      });
      if (!response.ok) throw new Error(await response.text());
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (cause) {
      endSession();
      setError(cause instanceof Error ? cause.message : "We could not start Rita Live.");
    }
  };

  const speakReply = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        setMood("ready");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const codes: Record<string, string> = {
        Arabic: "ar",
        English: "en",
        German: "de",
        Turkish: "tr",
      };
      const target = codes[language] ?? (/\p{Script=Arabic}/u.test(text) ? "ar" : "en");
      utterance.lang = target;
      const voice = window.speechSynthesis
        .getVoices()
        .find((item) => item.lang.toLowerCase().startsWith(target));
      if (voice) utterance.voice = voice;
      utterance.rate = 0.98;
      utterance.pitch = 1.04;
      utterance.onstart = () => {
        setMood("talking");
        setStatus("Rita is speaking");
      };
      utterance.onend = () => {
        const cheerful = /great|excellent|well done|bravo|أحسنت|ممتاز|رائع|sehr gut|harika/i.test(
          text,
        );
        setMood(cheerful ? "laughing" : "ready");
        setStatus("Ready for your next turn");
        if (cheerful) window.setTimeout(() => setMood("ready"), 1_500);
      };
      utterance.onerror = () => {
        setMood("ready");
        setStatus("Reply ready in the chat");
      };
      window.speechSynthesis.speak(utterance);
    },
    [language],
  );

  const runDemo = useCallback(
    async ({ blob, text }: { blob?: Blob; text?: string }) => {
      setError(null);
      setBusy(true);
      setActive(true);
      setMood("thinking");
      setStatus("Rita is thinking…");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please sign in before talking with Rita.");
        const form = new FormData();
        if (blob)
          form.append(
            "audio",
            blob,
            blob.type.includes("mp4") ? "recording.m4a" : "recording.webm",
          );
        if (text) form.append("text", text);
        form.append("personality", persona);
        form.append("language", language);
        form.append(
          "history",
          JSON.stringify(
            messages.slice(-10).map((item) => ({
              role: item.role === "rita" ? "assistant" : "user",
              content: item.text,
            })),
          ),
        );
        const response = await fetch("/api/rita/demo", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();
        if (!text && result.transcript) add("you", String(result.transcript));
        add("rita", String(result.reply));
        speakReply(String(result.reply));
      } catch (cause) {
        setMood("ready");
        setStatus("Demo voice is ready");
        setError(cause instanceof Error ? cause.message : "Rita could not answer right now.");
      } finally {
        setBusy(false);
      }
    },
    [add, language, messages, persona, speakReply],
  );

  const toggleDemoRecording = async () => {
    if (busy) return;
    if (recording && recorder.current) {
      recorder.current.stop();
      setStatus("Preparing your answer…");
      setMood("thinking");
      return;
    }
    setError(null);
    try {
      if (!("MediaRecorder" in window))
        throw new Error(
          "Voice recording is not supported in this browser. You can still type to Rita.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = media;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const nextRecorder = new MediaRecorder(
        media,
        preferred ? { mimeType: preferred } : undefined,
      );
      recorder.current = nextRecorder;
      chunks.current = [];
      nextRecorder.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      nextRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: nextRecorder.mimeType || "audio/webm" });
        stopMedia();
        if (blob.size < 1_000) {
          setMood("ready");
          setError("That recording was too short. Hold the microphone a little longer.");
          return;
        }
        void runDemo({ blob });
      };
      nextRecorder.start();
      setActive(true);
      setRecording(true);
      setMood("listening");
      setStatus("Listening — tap again when finished");
    } catch (cause) {
      stopMedia();
      setMood("ready");
      setError(cause instanceof Error ? cause.message : "Microphone access was not available.");
    }
  };

  const sendText = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    add("you", text);
    setDraft("");
    void runDemo({ text });
  };

  if (!loading && !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#100f12] text-white">
        <div className="max-w-sm p-8 text-center">
          <Bot className="mx-auto mb-4 text-orange-300" />
          <h1 className="text-2xl font-bold">Sign in to talk with Rita</h1>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-orange-300 px-5 py-3 font-bold text-stone-950"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const startLabel =
    mode === "live" ? "Start live conversation" : recording ? "Finish my turn" : "Speak to Rita";

  return (
    <main className="min-h-screen bg-[#130e0c] p-2 text-white md:p-5">
      <audio ref={audio} autoPlay />
      <div className="mx-auto grid min-h-[calc(100vh-1rem)] max-w-[1680px] overflow-hidden rounded-[24px] border border-white/10 bg-[#19130f] shadow-2xl md:min-h-[calc(100vh-2.5rem)] md:grid-cols-[minmax(0,1fr)_minmax(440px,1fr)] md:rounded-[38px]">
        <section className="order-2 flex min-h-[58vh] flex-col bg-[#fbf6ed] text-stone-900 md:order-1 md:min-h-0">
          <header className="flex items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-4 md:px-7 md:py-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black tracking-[.19em] text-orange-600 md:text-xs">
                  YOUR LIVE LESSON
                </p>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${mode === "live" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                >
                  {mode === "checking" ? "CHECKING" : mode === "live" ? "GPT LIVE" : "DEMO VOICE"}
                </span>
              </div>
              <h1 className="mt-1 text-lg font-extrabold md:text-xl">Talk with Rita</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold shadow-sm"
              >
                <Sparkles size={14} /> <span className="hidden sm:inline">Rita’s style</span>{" "}
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                aria-label="Leave Rita Live"
                onClick={() => {
                  endSession();
                  navigate({ to: "/" });
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-900"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {settingsOpen && (
            <div className="border-b border-stone-200 bg-white p-4 md:p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(personaCopy) as Persona[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    disabled={mode === "live" && active}
                    onClick={() => setPersona(item)}
                    className={`rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-50 ${persona === item ? "border-orange-400 bg-orange-50" : "border-stone-200 bg-white"}`}
                  >
                    <b>{personaCopy[item].label}</b>
                    <span className="mt-1 block text-xs text-stone-500">
                      {personaCopy[item].detail}
                    </span>
                  </button>
                ))}
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
                <Languages size={16} />
                <select
                  value={language}
                  disabled={mode === "live" && active}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white p-2"
                >
                  {languages.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              {mode === "live" && active && (
                <p className="mt-2 text-xs text-stone-500">
                  End this session to change Rita’s live teaching style.
                </p>
              )}
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-7">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex gap-3 ${message.role === "you" ? "justify-end" : ""}`}
              >
                {message.role === "rita" && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-200 text-orange-900">
                    <Sparkles size={15} />
                  </span>
                )}
                <div
                  className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "rita" ? "bg-white shadow-sm ring-1 ring-stone-900/5" : "bg-stone-900 text-white"}`}
                >
                  {message.text}
                </div>
              </article>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100">
                  <Volume2 size={15} />
                </span>
                <Loader2 size={15} className="animate-spin" /> Rita is thinking…
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

          <form onSubmit={sendText} className="border-t border-stone-200 bg-white p-4 md:p-5">
            <div className="flex gap-2">
              <input
                value={draft}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type to Rita…"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-400 disabled:bg-stone-50"
              />
              <button
                disabled={!draft.trim() || busy}
                className="grid h-12 w-12 place-items-center rounded-xl bg-stone-900 text-white disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
            <button
              type="button"
              disabled={mode === "checking" || busy}
              onClick={mode === "live" ? (active ? endSession : beginLive) : toggleDemoRecording}
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black shadow-sm transition-colors disabled:cursor-wait disabled:opacity-50 ${
                active && mode === "live"
                  ? "bg-rose-600 text-white"
                  : recording
                    ? "bg-orange-600 text-white"
                    : "bg-orange-100 text-orange-950 ring-1 ring-orange-200"
              }`}
            >
              {busy || mode === "checking" ? (
                <Loader2 size={17} className="animate-spin" />
              ) : active && mode === "live" ? (
                <CircleStop size={17} />
              ) : (
                <Mic size={17} />
              )}
              {active && mode === "live" ? "End live lesson" : startLabel}
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-500">
              {mode === "live"
                ? "Full-duplex OpenAI voice is active. Rita listens and answers naturally."
                : "Demo voice records one turn at a time and uses the available RitaJet AI credits plus your browser voice."}
            </p>
          </form>
        </section>

        <section className="order-1 min-h-[48vh] md:order-2 md:min-h-0">
          <RitaStage mood={mood} active={active || recording} />
        </section>
      </div>
    </main>
  );
}

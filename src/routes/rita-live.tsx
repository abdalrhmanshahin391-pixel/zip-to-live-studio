import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, CircleStop, Languages, Mic, MicOff, Send, Sparkles, Volume2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Mood = "listening" | "thinking" | "talking" | "ready";
type Persona = "kind" | "direct" | "playful" | "strict";
type Message = { id: string; role: "rita" | "you"; text: string };

const personaCopy: Record<Persona, { label: string; detail: string }> = {
  kind: { label: "Kind teacher", detail: "Warm, patient and encouraging" },
  direct: { label: "Direct teacher", detail: "Clear feedback, no sugar-coating" },
  playful: { label: "Playful teacher", detail: "Light, clever and encouraging" },
  strict: { label: "Strict teacher", detail: "Focused, structured and respectful" },
};

export const Route = createFileRoute("/rita-live")({
  head: () => ({ meta: [{ title: "Talk with Rita — RitaJet" }, { name: "robots", content: "noindex" }] }),
  component: RitaLivePage,
});

function RitaLivePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [persona, setPersona] = useState<Persona>("kind");
  const [language, setLanguage] = useState("Automatic — Rita listens first");
  const [mood, setMood] = useState<Mood>("ready");
  const [status, setStatus] = useState("Ready when you are");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "rita", text: "Hi, I’m Rita. Press the microphone and tell me what you want to practise." }]);
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);

  const cleanUp = useCallback(() => {
    channel.current?.close(); channel.current = null;
    peer.current?.close(); peer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    if (audio.current) audio.current.srcObject = null;
    setMood("ready"); setStatus("Session ended");
  }, []);
  useEffect(() => () => cleanUp(), [cleanUp]);

  const add = useCallback((role: Message["role"], text: string) => {
    const clean = text.trim(); if (!clean) return;
    setMessages((all) => [...all, { id: `${Date.now()}-${Math.random()}`, role, text: clean }]);
  }, []);

  const begin = async () => {
    if (peer.current) return;
    setError(null); setStatus("Asking for microphone access…"); setMood("thinking");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError("Please sign in before starting a live lesson."); setMood("ready"); return; }
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = media;
      const pc = new RTCPeerConnection(); peer.current = pc;
      pc.ontrack = (event) => { if (audio.current) { audio.current.srcObject = event.streams[0]; void audio.current.play(); } };
      media.getTracks().forEach((track) => pc.addTrack(track, media));
      const dc = pc.createDataChannel("oai-events"); channel.current = dc;
      dc.onopen = () => { setStatus("Rita is listening"); setMood("listening"); };
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "response.audio_transcript.delta") setMood("talking");
          if (data.type === "response.audio_transcript.done") { add("rita", data.transcript ?? ""); setMood("listening"); }
          if (data.type === "conversation.item.input_audio_transcription.completed") add("you", data.transcript ?? "");
          if (data.type === "error") setError("Rita had a connection problem. Please reconnect.");
        } catch { /* ignore non-JSON transport events */ }
      };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const response = await fetch("/api/rita/live", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sdp: offer.sdp, personality: persona, language }) });
      if (!response.ok) throw new Error(await response.text());
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (cause) {
      cleanUp();
      setError(cause instanceof Error ? cause.message : "We could not start Rita Live.");
    }
  };

  const sendText = () => {
    const text = draft.trim(); if (!text) return;
    add("you", text); setDraft("");
    if (channel.current?.readyState === "open") {
      channel.current.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
      channel.current.send(JSON.stringify({ type: "response.create" })); setMood("thinking");
    } else setError("Start the voice session first, then Rita can answer.");
  };

  if (!loading && !user) return <div className="grid min-h-screen place-items-center bg-[#100f12] text-white"><div className="max-w-sm p-8 text-center"><Bot className="mx-auto mb-4 text-orange-300" /><h1 className="text-2xl font-bold">Sign in to talk with Rita</h1><Link to="/login" className="mt-6 inline-block rounded-xl bg-orange-300 px-5 py-3 font-bold text-stone-950">Sign in</Link></div></div>;

  return <main className="min-h-screen bg-[#100f12] p-3 text-white md:p-5">
    <audio ref={audio} autoPlay />
    <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1600px] overflow-hidden rounded-[28px] border border-white/10 bg-[#19171b] shadow-2xl md:grid-cols-2 md:rounded-[38px]">
      <section className="relative flex min-h-[46vh] flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_25%,#6d4b45_0%,#34252b_35%,#17151b_70%)] p-5 md:min-h-0 md:p-8">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#f6b47b_1px,transparent_1px)] [background-size:25px_25px]" />
        <div className="relative z-10 flex items-center justify-between"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide">RITA LIVE</span><button type="button" aria-label="Leave Rita Live" onClick={() => { cleanUp(); navigate({ to: "/" }); }} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"><X size={21} /></button></div>
        <div className="relative z-10 m-auto flex w-full max-w-md flex-col items-center text-center">
          <RitaAvatar mood={mood} />
          <div className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80"><span className={`h-2 w-2 rounded-full ${peer.current ? "animate-pulse bg-emerald-400" : "bg-white/35"}`} />{status}</div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">{personaCopy[persona].detail}. Rita adapts to the language you speak.</p>
        </div>
        <div className="relative z-10 flex justify-center">{peer.current ? <button onClick={cleanUp} className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 font-bold text-white"><CircleStop size={19} /> End lesson</button> : <button onClick={begin} className="inline-flex items-center gap-2 rounded-2xl bg-orange-300 px-5 py-3 font-bold text-stone-950 shadow-lg shadow-orange-300/20"><Mic size={19} /> Start talking</button>}</div>
      </section>
      <section className="flex min-h-[54vh] flex-col bg-[#f9f4eb] text-stone-900 md:min-h-0">
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4 md:px-7"><div><p className="text-xs font-black tracking-[.18em] text-orange-600">YOUR LIVE LESSON</p><h1 className="mt-1 text-lg font-extrabold">Talk with Rita</h1></div><button onClick={() => setSettingsOpen((open) => !open)} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold"><Sparkles size={14} /> Rita’s style <ChevronDown size={14} /></button></header>
        {settingsOpen && <div className="border-b border-stone-200 bg-white p-4 md:p-5"><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(personaCopy) as Persona[]).map((item) => <button key={item} onClick={() => setPersona(item)} className={`rounded-xl border p-3 text-left text-sm ${persona === item ? "border-orange-400 bg-orange-50" : "border-stone-200 bg-white"}`}><b>{personaCopy[item].label}</b><span className="mt-1 block text-xs text-stone-500">{personaCopy[item].detail}</span></button>)}</div><label className="mt-4 flex items-center gap-2 text-sm font-semibold"><Languages size={16} /><select value={language} onChange={(e) => setLanguage(e.target.value)} className="flex-1 rounded-lg border border-stone-200 bg-white p-2"><option>Automatic — Rita listens first</option><option>Arabic</option><option>English</option><option>German</option><option>Turkish</option></select></label></div>}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-7">{messages.map((message) => <article key={message.id} className={`flex gap-3 ${message.role === "you" ? "justify-end" : ""}`}>{message.role === "rita" && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-200 text-orange-900"><Sparkles size={15} /></span>}<div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "rita" ? "bg-white shadow-sm" : "bg-stone-900 text-white"}`}>{message.text}</div></article>)}{mood === "thinking" && <div className="flex gap-2 text-sm text-stone-500"><span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100"><Volume2 size={15} /></span>Rita is thinking…</div>}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</div>
        <form onSubmit={(event) => { event.preventDefault(); sendText(); }} className="border-t border-stone-200 bg-white p-4 md:p-5"><div className="flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type to Rita…" className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-400" /><button className="grid h-12 w-12 place-items-center rounded-xl bg-stone-900 text-white" aria-label="Send message"><Send size={18} /></button></div><button type="button" onClick={peer.current ? cleanUp : begin} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800"><MicOff size={16} />{peer.current ? "Stop microphone" : "Start microphone"}</button></form>
      </section>
    </div>
  </main>;
}

function RitaAvatar({ mood }: { mood: Mood }) {
  const speaking = mood === "talking";
  return <div className="relative h-72 w-56 md:h-[30rem] md:w-80" aria-label={`Rita is ${mood}`}>
    <div className="absolute inset-x-5 bottom-0 h-44 rounded-t-[48%] bg-[#b98d6b] shadow-[inset_0_8px_18px_rgba(255,255,255,.12)] md:h-64" />
    <div className="absolute bottom-24 left-1/2 h-48 w-40 -translate-x-1/2 rounded-[48%_48%_43%_43%] bg-[#d79b71] shadow-[inset_10px_0_0_rgba(255,255,255,.12)] md:bottom-36 md:h-64 md:w-52">
      <div className="absolute -top-6 left-1/2 h-24 w-44 -translate-x-1/2 rounded-[52%_48%_32%_38%] bg-[#35241f] md:h-32 md:w-56" />
      <div className="absolute -top-10 left-1/2 flex h-8 w-28 -translate-x-1/2 justify-between rounded-full border-4 border-[#d66c1c] bg-transparent md:w-36"><span className="h-4 w-7 rounded-full bg-[#e98530]/80" /><span className="h-4 w-7 rounded-full bg-[#e98530]/80" /></div>
      <div className="absolute top-16 left-8 flex w-24 justify-between md:top-20 md:left-10 md:w-32"><span className={`h-3 w-7 rounded-full bg-[#35241f] ${mood === "thinking" ? "rotate-6" : ""}`} /><span className={`h-3 w-7 rounded-full bg-[#35241f] ${mood === "thinking" ? "-rotate-6" : ""}`} /></div>
      <div className="absolute top-24 left-1/2 h-3 w-7 -translate-x-1/2 rounded-full bg-[#873f3e] md:top-32">{speaking && <span className="absolute inset-0 animate-pulse rounded-full bg-[#4f2021]" />}</div>
    </div>
    <div className={`absolute bottom-10 left-1/2 h-32 w-48 -translate-x-1/2 rounded-t-[46%] bg-[#b98d6b] ${mood === "listening" ? "animate-[pulse_2s_ease-in-out_infinite]" : ""} md:h-44 md:w-64`} />
  </div>;
}

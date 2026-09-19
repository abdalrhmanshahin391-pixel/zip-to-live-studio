function abortError() {
  return new DOMException("Playback stopped", "AbortError");
}

function ensureActive(signal: AbortSignal) {
  if (signal.aborted) throw abortError();
}

function waitForSourceOpen(source: MediaSource, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Streaming playback was not available."));
    }, 3000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      source.removeEventListener("sourceopen", opened);
      source.removeEventListener("sourceclose", closed);
      signal.removeEventListener("abort", aborted);
    };
    const opened = () => {
      cleanup();
      resolve();
    };
    const closed = () => {
      cleanup();
      reject(new Error("The audio stream closed before playback."));
    };
    const aborted = () => {
      cleanup();
      reject(abortError());
    };
    source.addEventListener("sourceopen", opened, { once: true });
    source.addEventListener("sourceclose", closed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

function appendAudio(buffer: SourceBuffer, bytes: Uint8Array, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      buffer.removeEventListener("updateend", updated);
      buffer.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const updated = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("Could not decode Rita’s audio."));
    };
    const aborted = () => {
      cleanup();
      reject(abortError());
    };
    buffer.addEventListener("updateend", updated, { once: true });
    buffer.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    try {
      ensureActive(signal);
      buffer.appendBuffer(bytes as BufferSource);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/** Plays the same paid speech response as it arrives; the returned blob is for free replay. */
export async function playRitaSpeech(
  response: Response,
  audio: HTMLAudioElement,
  signal: AbortSignal,
  setUrl: (url: string) => void,
  beforePlay: () => void,
  onAudioReady: (blob: Blob) => void,
): Promise<Blob> {
  ensureActive(signal);
  const canStream =
    response.body &&
    typeof MediaSource !== "undefined" &&
    MediaSource.isTypeSupported("audio/mpeg");

  if (!canStream) {
    const blob = await response.blob();
    ensureActive(signal);
    if (!blob.size) throw new Error("Rita returned empty audio.");
    onAudioReady(blob);
    const url = URL.createObjectURL(blob);
    setUrl(url);
    audio.src = url;
    beforePlay();
    await audio.play();
    return blob;
  }

  const source = new MediaSource();
  const url = URL.createObjectURL(source);
  setUrl(url);
  audio.src = url;
  let buffer: SourceBuffer;
  try {
    await waitForSourceOpen(source, signal);
    ensureActive(signal);
    buffer = source.addSourceBuffer("audio/mpeg");
  } catch (error) {
    ensureActive(signal);
    URL.revokeObjectURL(url);
    const blob = await response.blob();
    ensureActive(signal);
    if (!blob.size) throw error;
    onAudioReady(blob);
    const fallbackUrl = URL.createObjectURL(blob);
    setUrl(fallbackUrl);
    audio.src = fallbackUrl;
    beforePlay();
    await audio.play();
    return blob;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let started: Promise<void> | null = null;
  try {
    while (true) {
      ensureActive(signal);
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const saved = new Uint8Array(new ArrayBuffer(value.byteLength));
      saved.set(value);
      chunks.push(saved);
      await appendAudio(buffer, value, signal);
      if (!started) {
        // Do not wait here: more bytes may be needed before play() can resolve.
        beforePlay();
        started = audio.play();
        void started.catch(() => undefined);
      }
    }
    if (!chunks.length) throw new Error("Rita returned empty audio.");
    if (source.readyState === "open") source.endOfStream();
    const blob = new Blob(chunks, { type: "audio/mpeg" });
    onAudioReady(blob);
    try {
      await started;
    } catch {
      // Some browsers accept MP3 files but cannot play MP3 via MediaSource.
      ensureActive(signal);
      URL.revokeObjectURL(url);
      const fallbackUrl = URL.createObjectURL(blob);
      setUrl(fallbackUrl);
      audio.src = fallbackUrl;
      beforePlay();
      await audio.play();
    }
    ensureActive(signal);
    return blob;
  } finally {
    reader.releaseLock();
  }
}

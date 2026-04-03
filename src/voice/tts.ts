import { cleanTextForSpeech } from "./cleanText";

let voicesReady = false;

function ensureVoices(): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  if (voicesReady && speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      voicesReady = true;
      resolve();
    };
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, 500);
  });
}

/** Prefere vozes neurais / naturais em pt-BR (menos robóticas). */
function pickBestPtBrVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const n = `${v.name} ${v.voiceURI}`.toLowerCase();
    const lang = v.lang?.toLowerCase() ?? "";
    if (lang === "pt-br") s += 40;
    else if (lang.startsWith("pt")) s += 25;
    if (/neural|natural|premium|enhanced|online/.test(n)) s += 35;
    if (/google|microsoft|edge|azure/.test(n)) s += 20;
    if (/maria|francisca|antonio|daniel|thomas|female|male/.test(n)) s += 5;
    return s;
  };

  const pt = voices.filter((v) => v.lang?.toLowerCase().startsWith("pt"));
  const pool = pt.length ? pt : voices;
  return pool.reduce((best, v) => (score(v) > score(best) ? v : best), pool[0]!);
}

let currentAudio: HTMLAudioElement | null = null;

export function cancelSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

/** Fallback: motor do browser com afinação mais natural. */
function speakTextBrowser(text: string): Promise<void> {
  return ensureVoices().then(
    () =>
      new Promise((resolve) => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "pt-BR";
        u.rate = 0.96;
        u.pitch = 1.04;
        u.volume = 1;
        const voice = pickBestPtBrVoice();
        if (voice) u.voice = voice;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      })
  );
}

/** TTS neural via servidor (Edge TTS), com fallback no browser. */
export function speakText(text: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return Promise.resolve();

  return (async () => {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned }),
      });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const a = new Audio(url);
        currentAudio = a;
        const done = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === a) currentAudio = null;
          resolve();
        };
        a.onended = done;
        a.onerror = done;
        void a.play().catch(done);
      });
    } catch {
      await speakTextBrowser(cleaned);
    }
  })();
}

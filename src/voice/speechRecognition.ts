/** API Web Speech (Chrome/Edge). */

export function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ?? null;
}

export const WAKE_VARIANTS = [
  "nero",
  "néro",
  "nerô",
  "neiro",
  "néiro",
  "nehru",
  "neuro",
  "mero",
  "zero",
  "nelo",
  "nélo",
  "nero ai",
  "ô nero",
  "ei nero",
];

export function transcriptHasWakeWord(lower: string): boolean {
  const t = lower.normalize("NFD").replace(/\p{M}/gu, "");
  return WAKE_VARIANTS.some((v) => t.includes(v));
}

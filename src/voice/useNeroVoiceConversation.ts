import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechRecognition, transcriptHasWakeWord } from "./speechRecognition";
import { cancelSpeech, speakText } from "./tts";
import { useNeroStore } from "../store";

type Phase = "off" | "standby" | "active_listening" | "processing";

async function fetchChat(message: string): Promise<{ reply: string; agentState?: string }> {
  const max = 4;
  let lastErr: Error | null = null;
  for (let i = 0; i < max; i++) {
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: (() => {
          const s = useNeroStore.getState();
          const payload: Record<string, string> = {
            message,
            provider: s.llmProvider,
          };
          const lm = s.localModel.trim();
          const gm = s.groqModel.trim();
          if (lm) payload.localModel = lm;
          if (gm) payload.groqModel = gm;
          return JSON.stringify(payload);
        })(),
      });
      const data = (await r.json()) as { reply?: string; agentState?: string; error?: string };
      if (!r.ok) throw new Error(data.error ?? data.reply ?? `HTTP ${r.status}`);
      return { reply: data.reply ?? "", agentState: data.agentState };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Falha ao contactar o servidor.");
}

function isDescansar(text: string): boolean {
  const t = text.toLowerCase();
  return ["vai descansar", "descansar", "agora não", "pode ir", "modo stand-by", "modo standby"].some((p) =>
    t.includes(p)
  );
}

function stripWakePrefix(text: string): string {
  let t = text.trim();
  const lower = t.toLowerCase();
  for (const w of ["nero", "néro", "ô nero", "ei nero"]) {
    if (lower.startsWith(w + ",") || lower.startsWith(w + " ")) {
      t = t.slice(w.length).replace(/^[, ]+/, "").trim();
      break;
    }
  }
  return t;
}

export function useNeroVoiceConversation() {
  const [phase, setPhase] = useState<Phase>("off");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState("");

  const phaseRef = useRef<Phase>("off");
  /** Voz ligada (evita comparações de tipo estreitas com phase em callbacks async). */
  const voiceEnabledRef = useRef(false);
  const standbyRecRef = useRef<SpeechRecognition | null>(null);
  const commandRecRef = useRef<SpeechRecognition | null>(null);
  const interruptRecRef = useRef<SpeechRecognition | null>(null);

  const setMood = useNeroStore((s) => s.setMood);
  const setLastReply = useNeroStore((s) => s.setLastReply);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopAllRecognition = useCallback(() => {
    for (const r of [standbyRecRef.current, commandRecRef.current, interruptRecRef.current]) {
      if (!r) continue;
      try {
        r.stop();
      } catch {
        /* */
      }
    }
    standbyRecRef.current = null;
    commandRecRef.current = null;
    interruptRecRef.current = null;
  }, []);

  const startInterruptListener = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    try {
      interruptRecRef.current?.stop();
    } catch {
      /* */
    }
    const r = new Ctor();
    interruptRecRef.current = r;
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = () => {
      cancelSpeech();
      try {
        r.stop();
      } catch {
        /* */
      }
    };
    r.onerror = () => {
      /* */
    };
    try {
      r.start();
    } catch {
      /* */
    }
  }, []);

  const listenOneCommandRef = useRef<() => void>(() => {});

  const handleUserText = useCallback(
    async (text: string) => {
      if (!text || !voiceEnabledRef.current) return;

      if (isDescansar(text)) {
        stopAllRecognition();
        cancelSpeech();
        setPhase("standby");
        phaseRef.current = "standby";
        setMood("idle");
        setSubtitle("Stand-by. Diga «Nero» para ativar.");
        await speakText("Combinado. Qualquer coisa é só chamar.");
        startStandbyInnerRef.current?.();
        return;
      }

      setPhase("processing");
      phaseRef.current = "processing";
      setMood("thinking");
      setSubtitle("Pensando…");

      try {
        const { reply, agentState } = await fetchChat(text);
        setLastReply(reply);
        if (agentState === "error") setMood("error");
        else if (agentState === "success") setMood("success");
        else setMood("speaking");

        setSubtitle("Nero responde…");

        startInterruptListener();
        await speakText(reply);
        cancelSpeech();
        try {
          interruptRecRef.current?.stop();
        } catch {
          /* */
        }
        interruptRecRef.current = null;

        window.setTimeout(() => useNeroStore.getState().setMood("idle"), 1800);

        if (voiceEnabledRef.current) {
          setPhase("active_listening");
          phaseRef.current = "active_listening";
          setSubtitle("Sua vez — fale o próximo comando.");
          listenOneCommandRef.current();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setVoiceError(msg);
        setMood("error");
        await speakText(
          "Tive um problema. Confirme se a API está em execução na porta 8787 e tente de novo."
        );
        if (voiceEnabledRef.current) {
          setPhase("active_listening");
          phaseRef.current = "active_listening";
          listenOneCommandRef.current();
        }
      }
    },
    [setLastReply, setMood, startInterruptListener, stopAllRecognition]
  );

  const listenOneCommand = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceError("Reconhecimento de voz não suportado. Use Chrome ou Edge.");
      voiceEnabledRef.current = false;
      setPhase("off");
      return;
    }

    if (!voiceEnabledRef.current) return;

    setPhase("active_listening");
    phaseRef.current = "active_listening";
    setMood("listening");
    setSubtitle("Ouvindo…");

    try {
      commandRecRef.current?.stop();
    } catch {
      /* */
    }

    const r = new Ctor();
    commandRecRef.current = r;
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = false;

    r.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const err = ev;
      if (err.error === "no-speech") {
        setSubtitle("Não ouvi — tenta de novo.");
        window.setTimeout(() => {
          if (voiceEnabledRef.current && phaseRef.current === "active_listening") {
            listenOneCommandRef.current();
          }
        }, 600);
        return;
      }
      if (err.error === "aborted") return;
      setVoiceError(err.message ?? err.error ?? "Erro no microfone");
    };

    r.onresult = (ev: SpeechRecognitionEvent) => {
      if (!ev.results.length) return;
      const raw = ev.results[0][0].transcript.trim();
      const text = stripWakePrefix(raw);
      setSubtitle(`Você: ${raw}`);
      void handleUserText(text || raw);
    };

    r.onend = () => {
      commandRecRef.current = null;
    };

    try {
      r.start();
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : String(e));
    }
  }, [handleUserText, setMood]);

  listenOneCommandRef.current = listenOneCommand;

  const startStandbyInnerRef = useRef<() => void>(() => {});

  const startStandby = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceError("Use Chrome ou Edge para voz.");
      return;
    }

    stopAllRecognition();

    const r = new Ctor();
    standbyRecRef.current = r;
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (ev: SpeechRecognitionEvent) => {
      if (phaseRef.current !== "standby") return;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        const transcript = ev.results[i][0].transcript;
        if (transcriptHasWakeWord(transcript.toLowerCase())) {
          phaseRef.current = "active_listening";
          setPhase("active_listening");
          try {
            r.stop();
          } catch {
            /* */
          }
          setSubtitle("Acordado! Fala o comando.");
          void speakText("Pode falar.").then(() => {
            if (voiceEnabledRef.current) listenOneCommandRef.current();
          });
          break;
        }
      }
    };

    r.onend = () => {
      if (phaseRef.current === "standby") {
        try {
          r.start();
        } catch {
          window.setTimeout(() => startStandbyInnerRef.current?.(), 300);
        }
      }
    };

    try {
      r.start();
    } catch {
      window.setTimeout(() => startStandbyInnerRef.current?.(), 400);
    }
  }, [stopAllRecognition]);

  startStandbyInnerRef.current = startStandby;

  const startVoice = useCallback(() => {
    setVoiceError(null);
    if (!getSpeechRecognition()) {
      setVoiceError("Navegador sem Web Speech API. Use Chrome ou Edge.");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setVoiceError("HTTPS ou localhost necessário para o microfone.");
      return;
    }
    voiceEnabledRef.current = true;
    setPhase("standby");
    phaseRef.current = "standby";
    setSubtitle("Stand-by. Diga «Nero» para ativar.");
    startStandby();
  }, [startStandby]);

  const stopVoice = useCallback(() => {
    voiceEnabledRef.current = false;
    stopAllRecognition();
    cancelSpeech();
    setPhase("off");
    phaseRef.current = "off";
    setSubtitle("");
    setMood("idle");
  }, [stopAllRecognition, setMood]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  return {
    phase,
    subtitle,
    voiceError,
    startVoice,
    stopVoice,
  };
}

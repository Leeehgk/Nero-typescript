import { useCallback, useEffect, useRef, useState } from "react";
import { isApprovalAffirmative, isApprovalNegative, resolveApproval, sendChatMessage } from "../api/nero";
import type { AgentApiResponse } from "../agentTypes";
import { useNeroStore } from "../store";
import { getSpeechRecognition, transcriptHasWakeWord } from "./speechRecognition";
import { cancelSpeech, speakText } from "./tts";

type Phase = "off" | "standby" | "active_listening" | "processing";

async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  const max = 4;
  let lastErr: Error | null = null;
  for (let i = 0; i < max; i++) {
    try {
      return await task();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Falha ao contactar o servidor.");
}

async function fetchChat(message: string): Promise<AgentApiResponse> {
  return withRetry(() => sendChatMessage(message));
}

async function resolvePendingTurn(approvalId: string, approved: boolean): Promise<AgentApiResponse> {
  return withRetry(() => resolveApproval(approvalId, approved));
}

function isDescansar(text: string): boolean {
  const t = text.toLowerCase();
  return ["vai descansar", "descansar", "agora nao", "agora nÃ£o", "pode ir", "modo stand-by", "modo standby"].some(
    (p) => t.includes(p)
  );
}

function stripWakePrefix(text: string): string {
  let t = text.trim();
  const lower = t.toLowerCase();
  for (const w of ["nero", "nero", "o nero", "ei nero"]) {
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
  const voiceEnabledRef = useRef(false);
  const isHandlingTurnRef = useRef(false);
  const activeTurnIdRef = useRef(0);
  const standbyRecRef = useRef<SpeechRecognition | null>(null);
  const commandRecRef = useRef<SpeechRecognition | null>(null);
  const interruptRecRef = useRef<SpeechRecognition | null>(null);

  const pendingApproval = useNeroStore((s) => s.pendingApproval);
  const setMood = useNeroStore((s) => s.setMood);
  const setLastReply = useNeroStore((s) => s.setLastReply);
  const setPendingApproval = useNeroStore((s) => s.setPendingApproval);
  const clearPendingApproval = useNeroStore((s) => s.clearPendingApproval);
  const activateComputer = useNeroStore((s) => s.activateComputer);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopAllRecognition = useCallback(() => {
    for (const r of [standbyRecRef.current, commandRecRef.current, interruptRecRef.current]) {
      if (!r) continue;
      try {
        r.stop();
      } catch {
        /* noop */
      }
    }
    standbyRecRef.current = null;
    commandRecRef.current = null;
    interruptRecRef.current = null;
  }, []);

  const stopInterruptListener = useCallback(() => {
    try {
      interruptRecRef.current?.stop();
    } catch {
      /* noop */
    }
    interruptRecRef.current = null;
  }, []);

  const startInterruptListener = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    stopInterruptListener();

    const r = new Ctor();
    interruptRecRef.current = r;
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (ev: SpeechRecognitionEvent) => {
      let isInterrupt = false;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0].transcript.toLowerCase();
        if (
          transcriptHasWakeWord(transcript) ||
          transcript.match(/\b(pare|chega|silêncio|psiu|shh|deu|parou|tá bom o áudio)\b/i) ||
          transcript.match(/\b(para de falar|para com isso)\b/i)
        ) {
          isInterrupt = true;
          break;
        }
      }
      
      if (isInterrupt) {
        cancelSpeech();
        stopInterruptListener();
      }
    };
    r.onerror = () => {
      /* noop */
    };
    try {
      r.start();
    } catch {
      /* noop */
    }
  }, [stopInterruptListener]);

  const listenOneCommandRef = useRef<() => void>(() => {});
  const startStandbyInnerRef = useRef<() => void>(() => {});
  const restartCommandListenerRef = useRef<number | null>(null);

  const clearRestartCommandTimer = useCallback(() => {
    if (restartCommandListenerRef.current !== null) {
      window.clearTimeout(restartCommandListenerRef.current);
      restartCommandListenerRef.current = null;
    }
  }, []);

  const scheduleCommandListenerRestart = useCallback(
    (delayMs = 250) => {
      clearRestartCommandTimer();
      restartCommandListenerRef.current = window.setTimeout(() => {
        restartCommandListenerRef.current = null;
        if (!voiceEnabledRef.current) return;
        if (phaseRef.current !== "active_listening") return;
        if (isHandlingTurnRef.current) return;
        listenOneCommandRef.current();
      }, delayMs);
    },
    [clearRestartCommandTimer]
  );

  const applyAgentResponse = useCallback(
    (data: AgentApiResponse) => {
      const reply = data.reply ?? data.error ?? "";
      setLastReply(reply);
      if (data.pendingApproval) setPendingApproval(data.pendingApproval);
      else clearPendingApproval();

      if (data.agentState === "error") setMood("error");
      else if (data.agentState === "success") setMood("success");
      else setMood("speaking");
      activateComputer();
      return reply;
    },
    [activateComputer, clearPendingApproval, setLastReply, setMood, setPendingApproval]
  );

  const restoreVoiceListening = useCallback(
    (nextSubtitle: string) => {
      if (!voiceEnabledRef.current) return;
      setPhase("active_listening");
      phaseRef.current = "active_listening";
      setSubtitle(nextSubtitle);
      scheduleCommandListenerRestart(120);
    },
    [scheduleCommandListenerRestart]
  );

  const handleUserText = useCallback(
    async (text: string) => {
      if (!text || !voiceEnabledRef.current || isHandlingTurnRef.current) return;

      isHandlingTurnRef.current = true;
      clearRestartCommandTimer();
      const turnId = ++activeTurnIdRef.current;

      try {
        const currentApproval = useNeroStore.getState().pendingApproval;
        if (currentApproval) {
          if (!isApprovalAffirmative(text) && !isApprovalNegative(text)) {
            const reminder = `Tenho uma aprovacao pendente para ${currentApproval.summary}. Diga sim para aprovar ou nao para cancelar.`;
            setLastReply(reminder);
            setMood("speaking");
            activateComputer();
            setSubtitle('Aguardando confirmacao. Diga "sim" ou "nao".');
            await speakText(reminder);
            if (turnId !== activeTurnIdRef.current) return;
            restoreVoiceListening('Aguardando confirmacao. Diga "sim" ou "nao".');
            return;
          }

          setPhase("processing");
          phaseRef.current = "processing";
          setMood("thinking");
          activateComputer();
          setSubtitle(isApprovalAffirmative(text) ? "Aprovando acao..." : "Cancelando acao...");

          const data = await resolvePendingTurn(currentApproval.id, isApprovalAffirmative(text));
          if (turnId !== activeTurnIdRef.current) return;

          const reply = applyAgentResponse(data);
          setSubtitle("Nero responde...");
          startInterruptListener();
          await speakText(reply);
          if (turnId !== activeTurnIdRef.current) return;

          cancelSpeech();
          stopInterruptListener();
          window.setTimeout(() => useNeroStore.getState().setMood("idle"), 1800);
          restoreVoiceListening("Sua vez - fale o proximo comando.");
          return;
        }

        if (isDescansar(text)) {
          stopAllRecognition();
          cancelSpeech();
          setPhase("standby");
          phaseRef.current = "standby";
          setMood("idle");
          setSubtitle("Stand-by. Diga 'Nero' para ativar.");
          await speakText("Combinado. Qualquer coisa e so chamar.");
          startStandbyInnerRef.current?.();
          return;
        }

        setPhase("processing");
        phaseRef.current = "processing";
        setMood("thinking");
        activateComputer();
        setSubtitle("Pensando...");

        const data = await fetchChat(text);
        if (turnId !== activeTurnIdRef.current) return;

        const reply = applyAgentResponse(data);
        const waitingApproval = Boolean(data.pendingApproval);
        setSubtitle(waitingApproval ? "Nero pede confirmacao..." : "Nero responde...");
        startInterruptListener();
        await speakText(reply);
        if (turnId !== activeTurnIdRef.current) return;

        cancelSpeech();
        stopInterruptListener();
        window.setTimeout(() => useNeroStore.getState().setMood("idle"), 1800);
        restoreVoiceListening(
          waitingApproval ? 'Aguardando confirmacao. Diga "sim" ou "nao".' : "Sua vez - fale o proximo comando."
        );
      } catch (e) {
        if (turnId !== activeTurnIdRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setVoiceError(msg);
        setMood("error");
        activateComputer();
        await speakText("Tive um problema. Confirme se a API esta em execucao na porta 8787 e tente de novo.");
        restoreVoiceListening("Nao consegui concluir. Tenta de novo.");
      } finally {
        if (turnId === activeTurnIdRef.current) {
          isHandlingTurnRef.current = false;
        }
      }
    },
    [
      activateComputer,
      applyAgentResponse,
      clearRestartCommandTimer,
      pendingApproval,
      restoreVoiceListening,
      setLastReply,
      setMood,
      startInterruptListener,
      stopAllRecognition,
      stopInterruptListener,
    ]
  );

  const listenOneCommand = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceError("Reconhecimento de voz nao suportado. Use Chrome ou Edge.");
      voiceEnabledRef.current = false;
      setPhase("off");
      return;
    }

    if (!voiceEnabledRef.current || isHandlingTurnRef.current) return;

    setPhase("active_listening");
    phaseRef.current = "active_listening";
    setMood("listening");
    setSubtitle(pendingApproval ? 'Aguardando confirmacao. Diga "sim" ou "nao".' : "Ouvindo...");
    clearRestartCommandTimer();

    try {
      commandRecRef.current?.stop();
    } catch {
      /* noop */
    }

    const r = new Ctor();
    commandRecRef.current = r;
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = false;

    r.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "no-speech") {
        setSubtitle("Nao ouvi - tenta de novo.");
        scheduleCommandListenerRestart(600);
        return;
      }
      if (ev.error === "aborted") return;
      setVoiceError(ev.message ?? ev.error ?? "Erro no microfone");
      scheduleCommandListenerRestart(800);
    };

    r.onresult = (ev: SpeechRecognitionEvent) => {
      if (!ev.results.length) return;
      const raw = ev.results[0][0].transcript.trim();
      const text = stripWakePrefix(raw);
      setSubtitle(`Voce: ${raw}`);
      void handleUserText(text || raw);
    };

    r.onend = () => {
      commandRecRef.current = null;
      if (voiceEnabledRef.current && phaseRef.current === "active_listening" && !isHandlingTurnRef.current) {
        scheduleCommandListenerRestart(250);
      }
    };

    try {
      r.start();
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : String(e));
      scheduleCommandListenerRestart(800);
    }
  }, [clearRestartCommandTimer, handleUserText, pendingApproval, scheduleCommandListenerRestart, setMood]);

  listenOneCommandRef.current = listenOneCommand;

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
            /* noop */
          }
          setSubtitle("Acordado! Fala o comando.");
          void speakText("Pode falar.").then(() => {
            if (voiceEnabledRef.current && !isHandlingTurnRef.current) {
              scheduleCommandListenerRestart(120);
            }
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
  }, [scheduleCommandListenerRestart, stopAllRecognition]);

  startStandbyInnerRef.current = startStandby;

  const startVoice = useCallback(() => {
    setVoiceError(null);
    if (!getSpeechRecognition()) {
      setVoiceError("Navegador sem Web Speech API. Use Chrome ou Edge.");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setVoiceError("HTTPS ou localhost necessario para o microfone.");
      return;
    }
    voiceEnabledRef.current = true;
    isHandlingTurnRef.current = false;
    setPhase("standby");
    phaseRef.current = "standby";
    setSubtitle("Stand-by. Diga 'Nero' para ativar.");
    startStandby();
  }, [startStandby]);

  const stopVoice = useCallback(() => {
    voiceEnabledRef.current = false;
    isHandlingTurnRef.current = false;
    activeTurnIdRef.current += 1;
    clearRestartCommandTimer();
    stopAllRecognition();
    cancelSpeech();
    setPhase("off");
    phaseRef.current = "off";
    setSubtitle("");
    setMood("idle");
  }, [clearRestartCommandTimer, stopAllRecognition, setMood]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  return {
    phase,
    subtitle,
    voiceError,
    startVoice,
    stopVoice,
  };
}

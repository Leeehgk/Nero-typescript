/// Nero: um avatar 3D que fala com LLMs locais ou na nuvem (Groq).
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { isApprovalAffirmative, isApprovalNegative, resolveApproval, sendChatMessage } from "./api/nero";
import type { AgentApiResponse } from "./agentTypes";
import { OfficeScene } from "./components/OfficeScene";
import { FurnitureStorePanel } from "./components/FurnitureStorePanel";
import { StylePanel } from "./components/StylePanel";
import { useNeroStore, type LlmProvider } from "./store";
import { useNeroVoiceConversation } from "./voice/useNeroVoiceConversation";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha de renderizacao capturada:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "linear-gradient(180deg, #f7f1e8 0%, #dcefe5 100%)",
            color: "#2d4a3e",
            fontFamily: '"VT323", "Segoe UI", system-ui, sans-serif',
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 34, marginBottom: 10 }}>Nero encontrou um erro visual.</div>
            <div style={{ fontSize: 22 }}>A interface foi preservada. Recarregue a pagina se a cena 3D nao voltar.</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function primaryButtonStyle(disabled = false) {
  return {
    padding: "12px 22px",
    borderRadius: 12,
    border: "3px solid #4a8fd4",
    background: disabled ? "linear-gradient(180deg,#d8e9f8,#bfd4e8)" : "linear-gradient(180deg,#9fd4ff,#6bb8ff)",
    color: "#153a5c",
    fontWeight: 700,
    fontSize: 18,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "3px 4px 0 #3a7bb8",
    opacity: disabled ? 0.7 : 1,
  } as const;
}

function successButtonStyle(disabled = false) {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "3px solid #3d8b72",
    background: disabled ? "linear-gradient(180deg,#d9eee6,#bdd8cc)" : "linear-gradient(180deg,#9ae0c5,#66bc98)",
    color: "#103d2e",
    fontWeight: 700,
    fontSize: 17,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "3px 4px 0 #2d6b56",
    opacity: disabled ? 0.7 : 1,
  } as const;
}

function dangerButtonStyle(disabled = false) {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "3px solid #c75c5c",
    background: disabled ? "linear-gradient(180deg,#f5dede,#e2c5c5)" : "linear-gradient(180deg,#ffb4b4,#e88888)",
    color: "#4a2020",
    fontWeight: 700,
    fontSize: 17,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "3px 4px 0 #a04444",
    opacity: disabled ? 0.7 : 1,
  } as const;
}

export function App() {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [apiCfg, setApiCfg] = useState<{
    localModel?: string;
    groqModel?: string;
    groqConfigured?: boolean;
    edgeTtsVoice?: string;
  }>({});
  const setMood = useNeroStore((s) => s.setMood);
  const setLastReply = useNeroStore((s) => s.setLastReply);
  const pendingApproval = useNeroStore((s) => s.pendingApproval);
  const setPendingApproval = useNeroStore((s) => s.setPendingApproval);
  const clearPendingApproval = useNeroStore((s) => s.clearPendingApproval);
  const activateComputer = useNeroStore((s) => s.activateComputer);
  const lastReply = useNeroStore((s) => s.lastReply);
  const mood = useNeroStore((s) => s.mood);
  const agentTarget = useNeroStore((s) => s.agentTarget);
  const agentDebug = useNeroStore((s) => s.agentDebug);
  const llmProvider = useNeroStore((s) => s.llmProvider);
  const setLlmProvider = useNeroStore((s) => s.setLlmProvider);
  const localModel = useNeroStore((s) => s.localModel);
  const groqModel = useNeroStore((s) => s.groqModel);
  const setLocalModel = useNeroStore((s) => s.setLocalModel);
  const setGroqModel = useNeroStore((s) => s.setGroqModel);

  const { phase: voicePhase, subtitle, voiceError, startVoice, stopVoice } = useNeroVoiceConversation();

  const bubbleText = (() => {
    const text = lastReply.trim();
    if (!text) return "";
    return text.length <= 140 ? text : `${text.slice(0, 139)}...`;
  })();

  useEffect(() => {
    void fetch("/api/config")
      .then((r) => r.json())
      .then(
        (d: {
          groqConfigured?: boolean;
          localModel?: string;
          groqModel?: string;
          edgeTtsVoice?: string;
        }) => setApiCfg(d)
      )
      .catch(() => setApiCfg({}));
  }, []);

  useEffect(() => {
    if (mood === "speaking" || mood === "success" || mood === "error") {
      const timer = setTimeout(() => {
        setMood("idle");
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [mood, setMood]);

  const applyAgentResponse = useCallback(
    (data: AgentApiResponse) => {
      const reply = data.reply ?? data.error ?? "Sem resposta.";
      setLastReply(reply);
      if (data.pendingApproval) setPendingApproval(data.pendingApproval);
      else clearPendingApproval();

      if (data.agentState === "error") setMood("error");
      else if (data.agentState === "success") setMood("success");
      else setMood("speaking");
      activateComputer();
    },
    [activateComputer, clearPendingApproval, setLastReply, setMood, setPendingApproval]
  );

  const submitApproval = useCallback(
    async (approved: boolean) => {
      const current = useNeroStore.getState().pendingApproval;
      if (!current || isSubmitting) return;

      setIsSubmitting(true);
      setMood("thinking");
      activateComputer();
      try {
        const data = await resolveApproval(current.id, approved);
        applyAgentResponse(data);
      } catch (err) {
        console.error("Erro ao resolver aprovacao:", err);
        setMood("error");
        activateComputer();
        setLastReply(err instanceof Error ? `Erro: ${err.message}` : "Nao consegui resolver a aprovacao agora.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [activateComputer, applyAgentResponse, isSubmitting, setLastReply, setMood]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isSubmitting) return;

    setInput("");
    setIsSubmitting(true);
    setMood("thinking");
    activateComputer();
    try {
      let data: AgentApiResponse;
      if (pendingApproval) {
        if (isApprovalAffirmative(text)) {
          data = await resolveApproval(pendingApproval.id, true);
        } else if (isApprovalNegative(text)) {
          data = await resolveApproval(pendingApproval.id, false);
        } else {
          setMood("speaking");
          activateComputer();
          setLastReply(`Acao pendente: ${pendingApproval.summary}. Responda "sim" ou "nao", ou use os botoes.`);
          return;
        }
      } else {
        data = await sendChatMessage(text);
      }
      applyAgentResponse(data);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      setMood("error");
      activateComputer();
      setLastReply(
        err instanceof Error ? `Erro: ${err.message}` : "Nao consegui falar com o servidor. Verifique o console."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [activateComputer, applyAgentResponse, input, isSubmitting, pendingApproval, setLastReply, setMood]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        fontFamily: '"VT323", "Segoe UI", system-ui, sans-serif',
      }}
    >
      <AppErrorBoundary>
        <OfficeScene />
      </AppErrorBoundary>
      {bubbleText && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 26,
            transform: "translateX(-50%)",
            width: "min(420px, calc(100vw - 32px))",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.96)",
              border: "3px solid #2d6b56",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 18,
              lineHeight: 1.25,
              color: "#1a3d32",
              textAlign: "center",
              boxShadow: "3px 4px 0 rgba(0,0,0,0.15)",
            }}
          >
            {bubbleText}
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 16,
          top: 16,
          width: 220,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(20, 28, 26, 0.82)",
          color: "#dff7ec",
          border: "2px solid rgba(127, 217, 184, 0.5)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
          fontSize: 14,
          lineHeight: 1.35,
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        <div style={{ fontSize: 16, marginBottom: 6, color: "#7fd9b8" }}>Debug Movimento</div>
        <div>
          mood global: <strong>{mood}</strong>
        </div>
        <div>
          alvo store: <strong>{agentTarget.x}, {agentTarget.z}</strong>
        </div>
        <div>
          pos avatar: <strong>{agentDebug ? `${agentDebug.position.x}, ${agentDebug.position.z}` : "sem dados"}</strong>
        </div>
        <div>
          alvo interno:{" "}
          <strong>{agentDebug ? `${agentDebug.internalTarget.x}, ${agentDebug.internalTarget.z}` : "sem dados"}</strong>
        </div>
        <div>
          andando: <strong>{agentDebug ? (agentDebug.walking ? "sim" : "nao") : "?"}</strong>
        </div>
        <div>
          mood avatar: <strong>{agentDebug?.mood ?? "sem dados"}</strong>
        </div>
        <div>
          atualizacao:{" "}
          <strong>
            {agentDebug ? `${Math.max(0, Math.round((Date.now() - agentDebug.updatedAt) / 100) / 10)}s` : "sem dados"}
          </strong>
        </div>
      </div>
      {showStore && <FurnitureStorePanel onClose={() => setShowStore(false)} />}
      {showStylePanel && <StylePanel onClose={() => setShowStylePanel(false)} />}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            alignSelf: "flex-start",
            maxWidth: 560,
            padding: "14px 16px",
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(255,252,245,0.97) 0%, rgba(232,245,236,0.96) 100%)",
            border: "3px solid #5aad8f",
            color: "#2d4a3e",
            fontSize: 17,
            lineHeight: 1.4,
            boxShadow: "4px 6px 0 #3d8b72, 8px 12px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            <span style={{ color: "#1e6b54" }}>NERO</span>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, fontSize: 16 }}>
              Cerebro:
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as LlmProvider)}
                style={{
                  fontFamily: "inherit",
                  fontSize: 16,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "2px solid #5aad8f",
                  background: "#fff",
                  color: "#2d4a3e",
                  cursor: "pointer",
                }}
              >
                <option value="local">LM Studio (local)</option>
                <option value="groq">Groq (nuvem)</option>
              </select>
            </label>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
              fontSize: 15,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Modelo LM Studio:
              <input
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder={apiCfg.localModel || "ex.: qwen2.5-7b-instruct"}
                style={{
                  width: 200,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "2px solid #8ec4b2",
                  fontFamily: "inherit",
                  fontSize: 15,
                }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Modelo Groq:
              <input
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                placeholder={apiCfg.groqModel || "llama-3.1-8b-instant"}
                style={{
                  width: 200,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "2px solid #8ec4b2",
                  fontFamily: "inherit",
                  fontSize: 15,
                }}
              />
            </label>
          </div>
          {apiCfg.groqConfigured === false && (
            <div style={{ fontSize: 14, color: "#a60", marginBottom: 6 }}>
              Groq: sem <code>GROQ_API_KEY</code> no servidor. A escolha funciona, mas o envio vai falhar ate
              configurares o .env.
            </div>
          )}
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
            TTS servidor: voz <code>{apiCfg.edgeTtsVoice ?? "pt-BR-AntonioNeural"}</code> (alterar{" "}
            <code>EDGE_TTS_VOICE</code> no .env)
          </div>
          <div style={{ fontSize: 15, opacity: 0.88, marginBottom: 8, color: "#355e4f" }}>
            Clica no chao para mover o Nero. <strong>WASD</strong> ou <strong>setas</strong> tambem andam um azulejo.
          </div>
          <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 6 }}>
            estado: <strong>{mood}</strong>
            {voicePhase !== "off" && (
              <>
                {" "}
                . voz: <strong>{voicePhase}</strong>
              </>
            )}
          </div>
          {voiceError && <div style={{ color: "#c44", marginBottom: 8, fontSize: 16 }}>{voiceError}</div>}
          {subtitle && <div style={{ opacity: 0.88, marginBottom: 8, fontSize: 16 }}>{subtitle}</div>}
          {pendingApproval && (
            <div
              style={{
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255, 248, 224, 0.95)",
                border: "2px solid #d1ab42",
                color: "#5c4407",
                boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Aguardando aprovacao</div>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{pendingApproval.summary}</div>
              <div style={{ fontSize: 15, whiteSpace: "pre-wrap", opacity: 0.9 }}>{pendingApproval.prompt}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => void submitApproval(true)}
                  disabled={isSubmitting}
                  style={successButtonStyle(isSubmitting)}
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => void submitApproval(false)}
                  disabled={isSubmitting}
                  style={dangerButtonStyle(isSubmitting)}
                >
                  Negar
                </button>
              </div>
            </div>
          )}
          {lastReply || "Fala ou escreve. A voz neural do Edge continua sendo servida pelo backend."}
        </div>
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            maxWidth: 620,
            alignItems: "center",
          }}
        >
          {voicePhase === "off" ? (
            <button type="button" onClick={startVoice} disabled={isSubmitting} style={successButtonStyle(isSubmitting)}>
              Ativar conversa por voz
            </button>
          ) : (
            <button type="button" onClick={stopVoice} disabled={isSubmitting} style={dangerButtonStyle(isSubmitting)}>
              Parar voz
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder={pendingApproval ? 'Responda "sim" ou "nao"...' : "Escreve aqui..."}
            disabled={isSubmitting}
            style={{
              flex: 1,
              minWidth: 220,
              padding: "12px 14px",
              borderRadius: 12,
              border: "3px solid #8ec4b2",
              background: isSubmitting ? "#edf3ef" : "#fffefb",
              color: "#2d4a3e",
              fontSize: 18,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button type="button" onClick={() => void send()} disabled={isSubmitting} style={primaryButtonStyle(isSubmitting)}>
            {pendingApproval ? "Responder" : "Enviar"}
          </button>
          <button type="button" onClick={() => setShowStore(!showStore)} style={successButtonStyle(false)}>
            🛒 Loja
          </button>
          <button type="button" onClick={() => setShowStylePanel(!showStylePanel)} style={primaryButtonStyle(false)}>
            🎨 Estilo
          </button>
        </div>
      </div>
    </div>
  );
}

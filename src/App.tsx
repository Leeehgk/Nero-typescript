/// Nero: um avatar 3D que fala com LLMs locais ou na nuvem (Groq).
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { OfficeScene } from "./components/OfficeScene";
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

export function App() {
  const [input, setInput] = useState("");
  const [apiCfg, setApiCfg] = useState<{
    localModel?: string;
    groqModel?: string;
    groqConfigured?: boolean;
    edgeTtsVoice?: string;
  }>({});
  const setMood = useNeroStore((s) => s.setMood);
  const setLastReply = useNeroStore((s) => s.setLastReply);
  const lastReply = useNeroStore((s) => s.lastReply);
  const mood = useNeroStore((s) => s.mood);
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
    // Efeito para retornar ao estado 'idle' após um tempo.
    // Isso centraliza a lógica, evita múltiplos `setTimeout` e é mais seguro.
    // O 'mood' é o gatilho perfeito para as animações do personagem na OfficeScene.
    // - "thinking": Correr para o computador.
    // - "speaking": Animação de fala.
    // - "idle": Movimentação aleatória pelo cenário.
    if (mood === "speaking" || mood === "success" || mood === "error") {
      const timer = setTimeout(() => {
        setMood("idle");
      }, 4000); // Tempo estendido para dar espaço para animações e falas.

      return () => clearTimeout(timer); // Limpa o timer se o humor mudar ou o componente desmontar.
    }
  }, [mood, setMood]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMood("thinking");
    try {
      const payload: Record<string, string> = { message: text, provider: llmProvider };
      const lm = localModel.trim();
      const gm = groqModel.trim();
      if (lm) payload.localModel = lm;
      if (gm) payload.groqModel = gm;
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Validação robusta da resposta para evitar a "tela branca" por JSON malformado.
      const responseText = await r.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Falha ao parsear JSON da resposta:", responseText);
        throw new Error(`O servidor respondeu com um formato inesperado. Resposta: ${responseText.slice(0, 200)}`);
      }

      if (typeof data !== "object" || !data) {
        throw new Error("Resposta da API em formato inválido (não é um objeto).");
      }

      const typedData = data as { reply?: string; agentState?: string; error?: string };
      const reply = typedData.reply ?? typedData.error ?? "Sem resposta.";
      setLastReply(reply);

      if (r.ok) {
        const st = typedData.agentState;
        if (st === "error") setMood("error");
        else if (st === "success") setMood("success");
        else setMood("speaking");
      } else {
        setMood("error");
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      setMood("error");
      setLastReply(
        err instanceof Error
          ? `Erro: ${err.message}`
          : "Não consegui falar com o servidor. Verifique o console."
      );
    }
  }, [input, llmProvider, localModel, groqModel, setLastReply, setMood]);

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
            maxWidth: 520,
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
          {/*
            COMO USAR O 'MOOD' PARA ANIMAÇÕES NA OfficeScene.tsx:
            1. Dentro de OfficeScene, use o hook da store: `const mood = useNeroStore(s => s.mood);`
            2. Use um `useEffect` para observar as mudanças no `mood`: `useEffect(() => { ... }, [mood]);`
            3. Dentro do `useEffect`, dispare a animação correspondente:
               - if (mood === 'thinking') { // lógica para correr para o computador }
               - if (mood === 'idle') { // lógica para andar aleatoriamente }
          */}
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
              Cérebro:
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
              Groq: sem <code>GROQ_API_KEY</code> no servidor — a escolha funciona, mas o envio vai falhar até
              configurares o .env.
            </div>
          )}
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
            TTS servidor: voz <code>{apiCfg.edgeTtsVoice ?? "pt-BR-AntonioNeural"}</code> (alterar{" "}
            <code>EDGE_TTS_VOICE</code> no .env)
          </div>
          <div style={{ fontSize: 15, opacity: 0.88, marginBottom: 8, color: "#355e4f" }}>
            Clica no chão para mover o Nero · <strong>WASD</strong> ou <strong>setas</strong> também andam um
            azulejo.
          </div>
          <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 6 }}>
            estado: <strong>{mood}</strong>
            {voicePhase !== "off" && (
              <>
                {" "}
                · voz: <strong>{voicePhase}</strong>
              </>
            )}
          </div>
          {voiceError && (
            <div style={{ color: "#c44", marginBottom: 8, fontSize: 16 }}>{voiceError}</div>
          )}
          {subtitle && (
            <div style={{ opacity: 0.88, marginBottom: 8, fontSize: 16 }}>{subtitle}</div>
          )}
          {lastReply || "Fala ou escreve — voz neural (Edge) pelo servidor."}
        </div>
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            maxWidth: 580,
            alignItems: "center",
          }}
        >
          {voicePhase === "off" ? (
            <button
              type="button"
              onClick={startVoice}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "3px solid #3d8b72",
                background: "linear-gradient(180deg,#7fd9b8,#5aad8f)",
                color: "#103d2e",
                fontWeight: 700,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "3px 4px 0 #2d6b56",
              }}
            >
              Ativar conversa por voz
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoice}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "3px solid #c75c5c",
                background: "linear-gradient(180deg,#ffb4b4,#e88888)",
                color: "#4a2020",
                fontWeight: 700,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "3px 4px 0 #a04444",
              }}
            >
              Parar voz
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escreve aqui…"
            style={{
              flex: 1,
              minWidth: 200,
              padding: "12px 14px",
              borderRadius: 12,
              border: "3px solid #8ec4b2",
              background: "#fffefb",
              color: "#2d4a3e",
              fontSize: 18,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={send}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              border: "3px solid #4a8fd4",
              background: "linear-gradient(180deg,#9fd4ff,#6bb8ff)",
              color: "#153a5c",
              fontWeight: 700,
              fontSize: 18,
              cursor: "pointer",
              boxShadow: "3px 4px 0 #3a7bb8",
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

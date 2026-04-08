import { useNeroStore, type ThemeMode, type SkinMode, type AgentShirtStyle, type AgentShoeStyle, type AgentHairStyle, type AgentEyeStyle } from "../store";

const themeLabels: Record<ThemeMode, string> = {
  common: "🏢 Sala Clássica",
  hacker: "💻 Dark Hacker",
  premium: "👑 Suíte Premium",
};

const skinLabels: Record<SkinMode, string> = {
  default: "👦 Natural",
  hacker: "🎭 Guy Fawkes",
};

const shirtLabels: Record<AgentShirtStyle, string> = {
  casual: "👕 Casual",
  formal: "🤵 Formal",
  esportivo: "🏃 Esportivo",
};

const shoeLabels: Record<AgentShoeStyle, string> = {
  tenis: "👟 Tênis",
  social: "👞 Social",
  bota: "🥾 Bota",
};

const hairLabels: Record<AgentHairStyle, string> = {
  curto: "💇 Curto Loiro",
  longo: "💇‍♂️ Longo Castanho",
  moicano: "🦄 Moicano Roxo",
};

const eyeLabels: Record<AgentEyeStyle, string> = {
  normal: "👁️ Normal Azul",
  anime: "✨ Anime Verde",
  cool: "😎 Óculos Escuros",
};

const sectionStyle = {
  marginBottom: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: "bold" as const,
  opacity: 0.7,
  marginBottom: 6,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

function OptionGroup<T extends string>({
  options,
  labels,
  value,
  onChange,
  activeColor,
  activeBorder,
}: {
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  activeColor: string;
  activeBorder: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "8px 12px",
              background: active ? activeColor : "transparent",
              color: active ? "#ffffff" : "#cbd5e1",
              border: active ? `2px solid ${activeBorder}` : "2px solid #334155",
              borderRadius: 8,
              fontSize: 16,
              textAlign: "left",
              cursor: "pointer",
              boxShadow: active ? `0 3px 12px ${activeColor}66` : "none",
              fontWeight: active ? "bold" : "normal",
              transition: "all 0.15s ease",
              fontFamily: "inherit",
            }}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

export function StylePanel({ onClose }: { onClose: () => void }) {
  const themeMode = useNeroStore((s) => s.themeMode);
  const setThemeMode = useNeroStore((s) => s.setThemeMode);
  const skinMode = useNeroStore((s) => s.skinMode);
  const setSkinMode = useNeroStore((s) => s.setSkinMode);
  const agentShirt = useNeroStore((s) => s.agentShirt);
  const setAgentShirt = useNeroStore((s) => s.setAgentShirt);
  const agentShoe = useNeroStore((s) => s.agentShoe);
  const setAgentShoe = useNeroStore((s) => s.setAgentShoe);
  const agentHair = useNeroStore((s) => s.agentHair);
  const setAgentHair = useNeroStore((s) => s.setAgentHair);
  const agentEye = useNeroStore((s) => s.agentEye);
  const setAgentEye = useNeroStore((s) => s.setAgentEye);

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        top: 250,
        width: 290,
        backgroundColor: "rgba(22, 26, 43, 0.97)",
        border: "3px solid #6366f1",
        borderRadius: 14,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        fontFamily: '"VT323", "Segoe UI", system-ui, sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 10,
        pointerEvents: "auto",
        color: "#f1f5f9",
      }}
    >
      {/* Header */}
      <div style={{ 
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)", 
        color: "#fff", 
        padding: "12px 16px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center" 
      }}>
        <span style={{ fontSize: 20, fontWeight: "bold" }}>🎨 Estilos & Avatar</span>
        <button 
          onClick={onClose} 
          style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}
        >
          ✖
        </button>
      </div>

      {/* Content — scrollable */}
      <div style={{ 
        padding: 14, 
        maxHeight: 420, 
        overflowY: "auto", 
        display: "flex", 
        flexDirection: "column", 
        gap: 10,
      }}>
        {/* Ambiente */}
        <div style={sectionStyle}>
          <div style={labelStyle}>🏠 Ambiente</div>
          <OptionGroup
            options={["common", "hacker", "premium"] as ThemeMode[]}
            labels={themeLabels}
            value={themeMode}
            onChange={setThemeMode}
            activeColor="#4f46e5"
            activeBorder="#818cf8"
          />
        </div>

        {/* Máscara */}
        <div style={sectionStyle}>
          <div style={labelStyle}>🎭 Máscara</div>
          <OptionGroup
            options={["default", "hacker"] as SkinMode[]}
            labels={skinLabels}
            value={skinMode}
            onChange={setSkinMode}
            activeColor="#8b5cf6"
            activeBorder="#a78bfa"
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "2px 0" }} />

        {/* Roupa */}
        <div style={sectionStyle}>
          <div style={labelStyle}>👕 Roupa</div>
          <OptionGroup
            options={["casual", "formal", "esportivo"] as AgentShirtStyle[]}
            labels={shirtLabels}
            value={agentShirt}
            onChange={setAgentShirt}
            activeColor="#0891b2"
            activeBorder="#22d3ee"
          />
        </div>

        {/* Sapato */}
        <div style={sectionStyle}>
          <div style={labelStyle}>👟 Sapato</div>
          <OptionGroup
            options={["tenis", "social", "bota"] as AgentShoeStyle[]}
            labels={shoeLabels}
            value={agentShoe}
            onChange={setAgentShoe}
            activeColor="#b45309"
            activeBorder="#fbbf24"
          />
        </div>

        {/* Cabelo */}
        <div style={sectionStyle}>
          <div style={labelStyle}>💇 Cabelo</div>
          <OptionGroup
            options={["curto", "longo", "moicano"] as AgentHairStyle[]}
            labels={hairLabels}
            value={agentHair}
            onChange={setAgentHair}
            activeColor="#d97706"
            activeBorder="#fcd34d"
          />
        </div>

        {/* Olhos */}
        <div style={sectionStyle}>
          <div style={labelStyle}>👁️ Olhos</div>
          <OptionGroup
            options={["normal", "anime", "cool"] as AgentEyeStyle[]}
            labels={eyeLabels}
            value={agentEye}
            onChange={setAgentEye}
            activeColor="#059669"
            activeBorder="#34d399"
          />
        </div>
      </div>
    </div>
  );
}

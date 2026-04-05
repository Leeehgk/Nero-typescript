import { useNeroStore, type ThemeMode, type SkinMode } from "../store";

const themeLabels: Record<ThemeMode, string> = {
  common: "🏢 Sala Clássica",
  hacker: "💻 Dark Hacker",
  premium: "👑 Suíte Premium",
};

const skinLabels: Record<SkinMode, string> = {
  default: "👦 Natural (Sem máscara)",
  hacker: "🎭 Anonymous (Guy Fawkes)",
};

export function StylePanel({ onClose }: { onClose: () => void }) {
  const themeMode = useNeroStore((s) => s.themeMode);
  const setThemeMode = useNeroStore((s) => s.setThemeMode);
  const skinMode = useNeroStore((s) => s.skinMode);
  const setSkinMode = useNeroStore((s) => s.setSkinMode);

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        top: 250, // Fica abaixo/perto da loja
        width: 280,
        backgroundColor: "rgba(22, 26, 43, 0.95)",
        border: "3px solid #6366f1", // indigo borda
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
        fontFamily: '"VT323", "Segoe UI", system-ui, sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 10,
        pointerEvents: "auto",
        color: "#f1f5f9",
      }}
    >
      <div style={{ background: "#4f46e5", color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, fontWeight: "bold" }}>🎨 Estilos</span>
        <button 
          onClick={onClose} 
          style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}
        >
          ✖
        </button>
      </div>

      <div style={{ padding: 14, minHeight: 240, maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: "bold", opacity: 0.8, marginBottom: 8, textTransform: "uppercase" }}>Estilos de Ambiente</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Object.keys(themeLabels) as ThemeMode[]).map((theme) => {
              const active = themeMode === theme;
              return (
                <button
                  key={theme}
                  onClick={() => setThemeMode(theme)}
                  style={{
                    padding: "10px 14px",
                    background: active ? "#6366f1" : "transparent",
                    color: active ? "#ffffff" : "#cbd5e1",
                    border: active ? "2px solid #818cf8" : "2px solid #334155",
                    borderRadius: 8,
                    fontSize: 18,
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: active ? "0 4px 15px rgba(99,102,241,0.4)" : "none",
                    fontWeight: active ? "bold" : "normal"
                  }}
                >
                  {themeLabels[theme]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontWeight: "bold", opacity: 0.8, marginBottom: 8, textTransform: "uppercase" }}>Avatar (Nero Skin)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Object.keys(skinLabels) as SkinMode[]).map((skin) => {
              const active = skinMode === skin;
              return (
                <button
                  key={skin}
                  onClick={() => setSkinMode(skin)}
                  style={{
                    padding: "10px 14px",
                    background: active ? "#8b5cf6" : "transparent",
                    color: active ? "#ffffff" : "#cbd5e1",
                    border: active ? "2px solid #a78bfa" : "2px solid #334155",
                    borderRadius: 8,
                    fontSize: 18,
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: active ? "0 4px 15px rgba(139,92,246,0.4)" : "none",
                    fontWeight: active ? "bold" : "normal"
                  }}
                >
                  {skinLabels[skin]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

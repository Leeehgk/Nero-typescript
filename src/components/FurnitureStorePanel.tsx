import React, { useState } from "react";
import { useNeroStore, type FurnitureType } from "../store";

const typeLabels: Record<FurnitureType, string> = {
  desk: "💻 Mesa Clássica",
  seating: "🪑 Poltronas Clássicas",
  rug: "🔲 Tapete Cinza",
  globe: "🌐 Globo Terrestre",
  plant: "🪴 Planta Fícus",
  painting: "🖼️ Quadro Abstrato",
  board: "📋 Quadro Cromado",
  bookshelf: "📚 Estante de Livros",
  sofa: "🛋️ Sofá Premium",
  lamp: "💡 Luminária de Piso",
  coffeetable: "☕ Mesa de Centro",
  tv: "📺 TV Telão Plana",
  bed: "🛏️ Cama de Casal",
  wardrobe: "🚪 Guarda-Roupas",
  diningtable: "🍽️ Mesa de Jantar",
  arcade: "🕹️ Máquina Fliperama",
  nightstand: "🪑 Criado-Mudo",
  bonsai: "🎋 Bonsai Zen",
  mirror: "🪞 Espelho de Pé",
  statue: "🗿 Estátua Abstrata",
  wall_clock: "🕰️ Relógio Analógico",
  speaker: "🔊 Torre de Som",
  fridge: "🧊 Geladeira Inox",
  fireplace: "🔥 Lareira Rústica",
  piano: "🎹 Piano de Cauda",
  vending: "🥤 Máquina de Vendas",
  barrel: "🛢️ Barril Viking",
};

export function FurnitureStorePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"shop" | "inventory">("shop");
  
  const furnitureList = useNeroStore((s) => s.furnitureList);
  const addFurniture = useNeroStore((s) => s.addFurniture);
  const removeFurniture = useNeroStore((s) => s.removeFurniture);
  const agentTarget = useNeroStore((s) => s.agentTarget); // We will place items here!

  const handleBuy = (type: FurnitureType) => {
    // If it's a rug, it usually has a rotation, but we can default rotation to [0,0,0] 
    // or let the rug component handle it. Currently the rug in defaultFurniture 
    // had `rotation: [-Math.PI / 2, 0, 0]`! We might want to pass it? 
    // Wait, let's keep rotation empty and for specific items we inject defaults if needed.
    const itemConfig: { position: [number, number, number]; rotation?: [number, number, number] } = {
      position: [agentTarget.x, Math.max(0, agentTarget.z * 0.01), agentTarget.z], // Avoid Z-fighting slightly if needed
    };

    if (type === "rug") {
      itemConfig.position[1] = 0.02; // lift rug slightly
    } else if (type === "globe" || type === "plant" || type === "bonsai" || type === "statue" || type === "mirror" || type === "speaker") {
      itemConfig.position[1] = 0;
    } else if (type === "wall_clock") {
      itemConfig.position[1] = 2.0; // Padrão mais alto para relógios
    }

    addFurniture({ type, ...itemConfig });
  };

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        top: 250, // Below the debug panel
        width: 280,
        backgroundColor: "rgba(238, 246, 242, 0.95)",
        border: "3px solid #5aad8f",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        fontFamily: '"VT323", "Segoe UI", system-ui, sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 5,
        pointerEvents: "auto",
        color: "#1a3d32",
      }}
    >
      {/* Header */}
      <div style={{ background: "#5aad8f", color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, fontWeight: "bold" }}>Loja de Móveis</span>
        <button 
          onClick={onClose} 
          style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}
        >
          ✖
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #bcebdb" }}>
        <button
          onClick={() => setTab("shop")}
          style={{ 
            flex: 1, 
            padding: 10, 
            background: tab === "shop" ? "transparent" : "#dcf2e8",
            border: "none", 
            borderBottom: tab === "shop" ? "3px solid #3d8b72" : "none",
            fontWeight: tab === "shop" ? "bold" : "normal",
            cursor: "pointer",
            fontSize: 16,
            color: "#1a3d32"
          }}
        >
          Catálogo
        </button>
        <button
          onClick={() => setTab("inventory")}
          style={{ 
            flex: 1, 
            padding: 10, 
            background: tab === "inventory" ? "transparent" : "#dcf2e8",
            border: "none", 
            borderBottom: tab === "inventory" ? "3px solid #3d8b72" : "none",
            fontWeight: tab === "inventory" ? "bold" : "normal",
            cursor: "pointer",
            fontSize: 16,
            color: "#1a3d32"
          }}
        >
          Inventário ({furnitureList.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 14, minHeight: 240, maxHeight: 360, overflowY: "auto" }}>
        {tab === "shop" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: "0 0 10px 0", fontSize: 15, opacity: 0.8 }}>
              Clique no chão verde da sala para escolher o azulejo, depois clique no móvel abaixo!
            </p>
            {(Object.keys(typeLabels) as FurnitureType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleBuy(type)}
                style={{
                  padding: "10px 14px",
                  background: "#fff",
                  border: "2px solid #8ec4b2",
                  borderRadius: 8,
                  fontSize: 18,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  boxShadow: "2px 2px 0px #8ec4b2"
                }}
              >
                <span>{typeLabels[type]}</span>
                <span style={{ fontSize: 14, color: "#1e6b54", background: "#e8f5f0", padding: "2px 6px", borderRadius: 4 }}>+ Adicionar</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {furnitureList.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6e8a7e", marginTop: 20 }}>Vazio! Compre algo!</div>
            ) : (
              furnitureList.map((item) => (
                <div 
                  key={item.id} 
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#fff",
                    border: "1px solid #bcebdb",
                    borderRadius: 6
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: "bold" }}>{typeLabels[item.type]}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>Pos: [{item.position[0]}, {item.position[2]}]</div>
                  </div>
                  <button 
                    onClick={() => removeFurniture(item.id)}
                    style={{
                      background: "#ffebee",
                      border: "1px solid #ffcdd2",
                      color: "#c62828",
                      borderRadius: 4,
                      padding: "4px 8px",
                      cursor: "pointer"
                    }}
                    title="Remover"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

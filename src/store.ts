import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingApproval } from "./agentTypes";

export type AgentMood = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";

export type ThemeMode = "common" | "hacker" | "premium";
export type SkinMode = "default" | "hacker";

export type LlmProvider = "local" | "groq";

export type FurnitureType = 
  | "desk" 
  | "seating" 
  | "rug" 
  | "globe" 
  | "plant" 
  | "painting" 
  | "board" 
  | "bookshelf" 
  | "sofa" 
  | "lamp" 
  | "coffeetable" 
  | "tv";

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const defaultFurniture: FurnitureItem[] = [
  { id: "f-desk-1", type: "desk", position: [2.2, 0, -3.6] },
  { id: "f-seating-1", type: "seating", position: [-1.5, 0, -3.8] },
  { id: "f-rug-1", type: "rug", position: [-2.5, 0.02, 1.5] },
  { id: "f-globe-1", type: "globe", position: [3.2, 0, 1.2] },
  { id: "f-plant-1", type: "plant", position: [-3.5, 0, -2] },
];

/** Casa no piso (-5…5) — estilo Habbo por azulejo. */
export type AgentGrid = { x: number; z: number };
export type AgentDebug = {
  position: { x: number; z: number };
  internalTarget: AgentGrid;
  storeTarget: AgentGrid;
  walking: boolean;
  mood: AgentMood;
  updatedAt: number;
};
export type PathDebug = AgentGrid[];

let computerActiveTimer: ReturnType<typeof setTimeout> | null = null;

const GRID = { min: -5, max: 5 } as const;

function clampGrid(x: number, z: number): AgentGrid {
  return {
    x: Math.max(GRID.min, Math.min(GRID.max, Math.round(x))),
    z: Math.max(GRID.min, Math.min(GRID.max, Math.round(z))),
  };
}

type Store = {
  isStoreOpen: boolean;
  setStoreOpen: (open: boolean) => void;
  mood: AgentMood;
  lastReply: string;
  llmProvider: LlmProvider;
  pendingApproval: PendingApproval | null;
  /** Nome do modelo (vazio = usa .env no servidor). */
  localModel: string;
  groqModel: string;
  /** Destino de movimento (centro do azulejo). */
  agentTarget: AgentGrid;
  agentDebug: AgentDebug | null;
  pathDebug: PathDebug;
  computerActive: boolean;
  setAgentTarget: (x: number, z: number) => void;
  nudgeAgent: (dx: number, dz: number) => void;
  setAgentDebug: (debug: AgentDebug) => void;
  setPathDebug: (pathDebug: PathDebug) => void;
  activateComputer: (durationMs?: number) => void;
  setMood: (m: AgentMood) => void;
  setLastReply: (s: string) => void;
  setPendingApproval: (approval: PendingApproval | null) => void;
  clearPendingApproval: () => void;
  setLlmProvider: (p: LlmProvider) => void;
  setLocalModel: (s: string) => void;
  setGroqModel: (s: string) => void;
  furnitureList: FurnitureItem[];
  addFurniture: (item: Omit<FurnitureItem, "id">) => void;
  removeFurniture: (id: string) => void;
  updateFurniture: (id: string, updates: Partial<FurnitureItem>) => void;
  draggingFurnitureId: string | null;
  setDraggingFurnitureId: (id: string | null) => void;
  themeMode: ThemeMode;
  setThemeMode: (theme: ThemeMode) => void;
  skinMode: SkinMode;
  setSkinMode: (skin: SkinMode) => void;
};

export const useNeroStore = create<Store>()(
  persist(
    (set, get) => ({
      mood: "idle" as AgentMood,
      lastReply: "",
      llmProvider: "local" as LlmProvider,
      pendingApproval: null,
      localModel: "",
      groqModel: "",
      furnitureList: defaultFurniture,
      addFurniture: (item) => {
        set((state) => ({
          furnitureList: [...state.furnitureList, { ...item, id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}` }]
        }));
      },
      removeFurniture: (id) => {
        set((state) => ({
          furnitureList: state.furnitureList.filter((f) => f.id !== id)
        }));
      },
      updateFurniture: (id, updates) => {
        set((state) => ({
          furnitureList: state.furnitureList.map((f) => (f.id === id ? { ...f, ...updates } : f))
        }));
      },
      isStoreOpen: false,
  setStoreOpen: (open) => set({ isStoreOpen: open }),
  
  agentTarget: { x: 1, z: 1 },
      agentDebug: null,
      pathDebug: [],
      computerActive: false,
      setAgentTarget: (x, z) => set({ agentTarget: clampGrid(x, z) }),
      nudgeAgent: (dx, dz) => {
        const { x, z } = get().agentTarget;
        set({ agentTarget: clampGrid(x + dx, z + dz) });
      },
      setAgentDebug: (agentDebug) => set({ agentDebug }),
      setPathDebug: (pathDebug) => set({ pathDebug }),
      activateComputer: (durationMs = 10000) => {
        if (computerActiveTimer) clearTimeout(computerActiveTimer);
        set({ computerActive: true });
        computerActiveTimer = setTimeout(() => {
          set({ computerActive: false });
          computerActiveTimer = null;
        }, durationMs);
      },
      setMood: (mood) => set({ mood }),
      setLastReply: (lastReply) => set({ lastReply }),
      setPendingApproval: (pendingApproval) => set({ pendingApproval }),
      clearPendingApproval: () => set({ pendingApproval: null }),
      setLlmProvider: (llmProvider) => set({ llmProvider }),
      setLocalModel: (localModel) => set({ localModel }),
      setGroqModel: (groqModel) => set({ groqModel }),
      draggingFurnitureId: null,
      setDraggingFurnitureId: (draggingFurnitureId) => set({ draggingFurnitureId }),
      themeMode: "common",
      setThemeMode: (themeMode) => set({ themeMode }),
      skinMode: "default",
      setSkinMode: (skinMode) => set({ skinMode }),
    }),
    {
      name: "nero-settings",
      partialize: (s) => ({
        llmProvider: s.llmProvider,
        localModel: s.localModel,
        groqModel: s.groqModel,
        furnitureList: s.furnitureList,
      }),
    }
  )
);

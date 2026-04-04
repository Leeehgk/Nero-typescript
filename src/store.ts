import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingApproval } from "./agentTypes";

export type AgentMood = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";

export type LlmProvider = "local" | "groq";

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

let computerActiveTimer: ReturnType<typeof setTimeout> | null = null;

const GRID = { min: -5, max: 5 } as const;

function clampGrid(x: number, z: number): AgentGrid {
  return {
    x: Math.max(GRID.min, Math.min(GRID.max, Math.round(x))),
    z: Math.max(GRID.min, Math.min(GRID.max, Math.round(z))),
  };
}

type Store = {
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
  computerActive: boolean;
  setAgentTarget: (x: number, z: number) => void;
  nudgeAgent: (dx: number, dz: number) => void;
  setAgentDebug: (debug: AgentDebug) => void;
  activateComputer: (durationMs?: number) => void;
  setMood: (m: AgentMood) => void;
  setLastReply: (s: string) => void;
  setPendingApproval: (approval: PendingApproval | null) => void;
  clearPendingApproval: () => void;
  setLlmProvider: (p: LlmProvider) => void;
  setLocalModel: (s: string) => void;
  setGroqModel: (s: string) => void;
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
      agentTarget: { x: 1, z: 1 },
      agentDebug: null,
      computerActive: false,
      setAgentTarget: (x, z) => set({ agentTarget: clampGrid(x, z) }),
      nudgeAgent: (dx, dz) => {
        const { x, z } = get().agentTarget;
        set({ agentTarget: clampGrid(x + dx, z + dz) });
      },
      setAgentDebug: (agentDebug) => set({ agentDebug }),
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
    }),
    {
      name: "nero-settings",
      partialize: (s) => ({
        llmProvider: s.llmProvider,
        localModel: s.localModel,
        groqModel: s.groqModel,
      }),
    }
  )
);

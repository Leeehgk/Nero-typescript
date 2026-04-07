export type AgentState = "speaking" | "success" | "error" | "awaiting_approval";

export type PlannedActionPublic = {
  name: string;
  summary: string;
};

export type PendingApproval = {
  id: string;
  toolName: string;
  summary: string;
  prompt: string;
  requestedAt: number;
  /** true quando é uma aprovação em batch (modo agente). */
  isBatch?: boolean;
  /** Lista de ações planejadas (apenas em batch). */
  plannedActions?: PlannedActionPublic[];
};

export type AgentApiResponse = {
  reply?: string;
  error?: string;
  agentState?: AgentState;
  pendingApproval?: PendingApproval;
  toolCalls?: string[];
  provider?: string;
};

export type AgentState = "speaking" | "success" | "error" | "awaiting_approval";

export type PendingApproval = {
  id: string;
  toolName: string;
  summary: string;
  prompt: string;
  requestedAt: number;
};

export type AgentApiResponse = {
  reply?: string;
  error?: string;
  agentState?: AgentState;
  pendingApproval?: PendingApproval;
  toolCalls?: string[];
  provider?: string;
};

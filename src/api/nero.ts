import type { AgentApiResponse } from "../agentTypes";
import { useNeroStore } from "../store";

async function parseAgentResponse(r: Response): Promise<AgentApiResponse> {
  const raw = await r.text();
  let data: AgentApiResponse;
  try {
    data = JSON.parse(raw) as AgentApiResponse;
  } catch {
    throw new Error(`Resposta invalida do servidor: ${raw.slice(0, 200)}`);
  }

  if (!r.ok) {
    throw new Error(data.error ?? data.reply ?? `HTTP ${r.status}`);
  }
  return data;
}

export async function sendChatMessage(message: string): Promise<AgentApiResponse> {
  const s = useNeroStore.getState();
  const payload: Record<string, string> = {
    message,
    provider: s.llmProvider,
  };
  const lm = s.localModel.trim();
  const gm = s.groqModel.trim();
  if (lm) payload.localModel = lm;
  if (gm) payload.groqModel = gm;

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseAgentResponse(r);
}

export async function resolveApproval(approvalId: string, approved: boolean): Promise<AgentApiResponse> {
  const r = await fetch("/api/approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvalId, approved }),
  });
  return parseAgentResponse(r);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isApprovalAffirmative(text: string): boolean {
  const t = normalize(text);
  return ["sim", "pode", "ok", "okay", "confirmo", "confirmar", "aprovar", "autorizo", "autorizar"].some(
    (value) => t === value || t.startsWith(`${value} `)
  );
}

export function isApprovalNegative(text: string): boolean {
  const t = normalize(text);
  return ["nao", "nega", "negar", "cancelar", "cancela", "recusar", "recuso"].some(
    (value) => t === value || t.startsWith(`${value} `)
  );
}

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do projeto (pasta Nero-typescript) */
export const PROJECT_ROOT = __dirname.includes("dist-server")
  ? path.resolve(__dirname, "../..")
  : path.resolve(__dirname, "..");

export const CONFIG_FILE = path.join(PROJECT_ROOT, "config_eon.json");
export const ANOTACOES_FILE = path.join(PROJECT_ROOT, "anotacoes_nero.txt");
export const PRINTS_DIR = path.join(PROJECT_ROOT, "Prints");

// ─── Obsidian / Nero-brain ────────────────────────────────────
/** Raiz do cofre Obsidian */
export const NERO_BRAIN_DIR = path.join(PROJECT_ROOT, "Nero-brain");
/** Arquivo de memória curta da sessão, escondido do vault do Obsidian */
export const MEMORIA_FILE = path.join(NERO_BRAIN_DIR, ".obsidian", "memoria_contexto.json");
/** Indice local da rede de memoria do Nero para respostas sem LLM */
export const MEMORIA_GRAPH_FILE = path.join(NERO_BRAIN_DIR, ".obsidian", "rede_neural.json");

/** Sub-pasta: fatos sobre o usuário */
export const OB_PERFIL_DIR = path.join(NERO_BRAIN_DIR, "Perfil");
/** Sub-pasta: resumos de sessões de chat */
export const OB_CONVERSAS_DIR = path.join(NERO_BRAIN_DIR, "Conversas");
/** Sub-pasta: tópicos pesquisados na web */
export const OB_CONHECIMENTO_DIR = path.join(NERO_BRAIN_DIR, "Base de Conhecimento");
/** Sub-pasta: aprendizado contínuo do Nero */
export const OB_APRENDIZADO_DIR = path.join(NERO_BRAIN_DIR, "Aprendizado");
/** Sub-pasta: mapas e regras do cérebro */
export const OB_SISTEMA_DIR = path.join(NERO_BRAIN_DIR, "Sistema");
/** Sub-pasta: projetos ativos e backlog */
export const OB_PROJETOS_DIR = path.join(NERO_BRAIN_DIR, "Projetos");
/** Sub-pasta: áreas permanentes de responsabilidade */
export const OB_AREAS_DIR = path.join(NERO_BRAIN_DIR, "Areas");
/** Sub-pasta: recursos e materiais de referência */
export const OB_RECURSOS_DIR = path.join(NERO_BRAIN_DIR, "Recursos");
/** Sub-pasta: capturas rápidas e entradas brutas */
export const OB_INBOX_DIR = path.join(NERO_BRAIN_DIR, "Inbox");

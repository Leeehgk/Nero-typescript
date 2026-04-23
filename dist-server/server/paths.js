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
/** Sub-pasta: fatos sobre o usuário */
export const OB_PERFIL_DIR = path.join(NERO_BRAIN_DIR, "Perfil");
/** Sub-pasta: resumos de sessões de chat */
export const OB_CONVERSAS_DIR = path.join(NERO_BRAIN_DIR, "Conversas");
/** Sub-pasta: tópicos pesquisados na web */
export const OB_CONHECIMENTO_DIR = path.join(NERO_BRAIN_DIR, "Base de Conhecimento");
/** Sub-pasta: aprendizado contínuo do Nero */
export const OB_APRENDIZADO_DIR = path.join(NERO_BRAIN_DIR, "Aprendizado");

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do projeto (pasta Nero-typescript) */
export const PROJECT_ROOT = path.resolve(__dirname, "..");

export const MEMORIA_FILE = path.join(PROJECT_ROOT, "memoria_nero.json");
export const PERFIL_FILE = path.join(PROJECT_ROOT, "perfil_nero.json");
export const CONFIG_FILE = path.join(PROJECT_ROOT, "config_eon.json");
export const ANOTACOES_FILE = path.join(PROJECT_ROOT, "anotacoes_nero.txt");
export const PRINTS_DIR = path.join(PROJECT_ROOT, "Prints");

import fs from "node:fs";
import { CONFIG_FILE } from "./paths.js";

export function lerConfigNome(): string {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const dados = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as { nome_usuario?: string };
      return dados.nome_usuario ?? "chefe";
    }
  } catch {
    /* */
  }
  return "chefe";
}

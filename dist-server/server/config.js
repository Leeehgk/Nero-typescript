import fs from "node:fs";
import { CONFIG_FILE } from "./paths.js";
export function lerConfigNome() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const dados = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
            return dados.nome_usuario ?? "chefe";
        }
    }
    catch {
        /* */
    }
    return "chefe";
}

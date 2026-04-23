import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import https from "node:https";
import http from "node:http";
import open from "open";
import { ANOTACOES_FILE, PRINTS_DIR } from "./paths.js";
import { VK, enviarTeclaMidiaVirtualKey } from "./winkeys.js";
import { lerPaginaWebComoMarkdown, pesquisarDuckDuckGoNodeless } from "./browser.js";
import { lerNota, salvarNota, listarNotas, buscarNoCofre, salvarConhecimento } from "./obsidian.js";

const execFileAsync = promisify(execFile);

async function httpGetText(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "tocar_youtube",
      description:
        "TOQUE MÚSICA NO YOUTUBE. Use quando usuário pedir tocar música, YouTube, ouvir artista. Parâmetro pesquisa: o que tocar.",
      parameters: {
        type: "object",
        properties: { pesquisa: { type: "string", description: "Termo de busca no YouTube" } },
        required: ["pesquisa"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "controlar_midia",
      description:
        "Controla a reprodução de mídia (música/vídeo). Use para tocar/pausar, ou ir para a próxima ou anterior.",
      parameters: {
        type: "object",
        properties: {
          acao: {
            type: "string",
            description: "A ação a ser executada.",
            enum: ["play_pause", "proximo", "anterior"],
          },
        },
        required: ["acao"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "esconder_todas_janelas",
      description: "Minimiza todas as janelas visiveis. Use para pedidos como minimizar, esconder ou ocultar as janelas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restaurar_todas_janelas",
      description: "Restaura as janelas minimizadas anteriormente. Use para mostrar as janelas novamente.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "alternar_janelas",
      description: "Win+D — alterna área de trabalho.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "alterar_volume",
      description: "Volume: aumentar, diminuir ou mutar.",
      parameters: {
        type: "object",
        properties: {
          acao: { type: "string", description: "aumentar, diminuir, mutar" },
        },
        required: ["acao"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "minimizar_programa",
      description: "Minimiza a janela visivel de um programa especifico pelo nome. Ex.: Chrome, Notepad, VS Code, Explorer.",
      parameters: {
        type: "object",
        properties: { nome: { type: "string" } },
        required: ["nome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restaurar_programa",
      description: "Restaura a janela minimizada de um programa especifico pelo nome. Ex.: Chrome, Notepad, VS Code, Explorer.",
      parameters: {
        type: "object",
        properties: { nome: { type: "string" } },
        required: ["nome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "obter_data_hora",
      description: "Data e hora atuais.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "obter_clima",
      description: "Clima de uma cidade.",
      parameters: {
        type: "object",
        properties: { cidade: { type: "string" } },
        required: ["cidade"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ler_noticias_dia",
      description: "Resumo de notícias (busca web).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pesquisar_web",
      description: "Pesquisa na internet.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "abrir_navegador",
      description: "Abre URL no navegador padrão.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "abrir_pasta",
      description:
        "Abre uma pasta do Windows. Use para Documentos, Downloads, Desktop, Imagens, Videos, Musicas ou para abrir uma subpasta dentro de uma pasta base. Parametro nome: pasta desejada ou caminho. Parametro dentro_de: pasta base opcional, como documentos.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          dentro_de: { type: "string" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fechar_pasta",
      description:
        "Fecha uma janela aberta do Explorer para uma pasta do Windows. Use para Documentos, Downloads, Desktop, Imagens, Videos, Musicas ou para fechar uma subpasta dentro de uma pasta base. Parametro nome: pasta desejada ou caminho. Parametro dentro_de: pasta base opcional, como documentos.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          dentro_de: { type: "string" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "abrir_programa",
      description: "Abre programa Windows (calculadora, notepad, paint, etc.). Nao use para pastas.",
      parameters: {
        type: "object",
        properties: { nome: { type: "string" } },
        required: ["nome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fechar_programa",
      description: "Fecha um programa pelo nome. Nao use para pastas do Explorer.",
      parameters: {
        type: "object",
        properties: { nome: { type: "string" } },
        required: ["nome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "capturar_tela",
      description: "Salva screenshot em Prints/. Use apenas quando o usuario quiser tirar, salvar ou gerar um print da tela.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analisar_tela",
      description:
        "Captura a tela atual e responde sobre o que aparece nela. Use para pedidos como olhar a tela, descrever o que aparece, ler textos visiveis ou dizer o que esta na tela.",
      parameters: {
        type: "object",
        properties: {
          pergunta: {
            type: "string",
            description: "Pergunta visual do usuario, por exemplo: o que aparece na tela, leia o texto da tela, qual programa esta aberto.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "criar_anotacao",
      description: "Salva anotação em arquivo.",
      parameters: {
        type: "object",
        properties: { texto: { type: "string" } },
        required: ["texto"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "obter_musica_atual",
      description: "Tenta informar mídia em reprodução (Windows / PowerShell).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "executar_comando_terminal",
      description: "Executa um comando no terminal (Powershell). Use para automação do sistema profundo, instalação, gerenciamento de SO, ou deploy.",
      parameters: {
        type: "object",
        properties: { comando: { type: "string" } },
        required: ["comando"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ler_arquivo",
      description: "Retorna o conteúdo em texto de um arquivo.",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" } },
        required: ["caminho"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escrever_arquivo",
      description: "Grava conteúdo em texto num arquivo (sobrescreve se existir).",
      parameters: {
        type: "object",
        properties: {
          caminho: { type: "string" },
          conteudo: { type: "string" },
        },
        required: ["caminho", "conteudo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "obter_local_pasta",
      description: "Obtem o caminho absoluto de uma pasta do sistema do usuario (ex: Desktop, Documentos, Downloads). Use isso ANTES de criar ou ler arquivos em pastas padrão para não errar o caminho.",
      parameters: {
        type: "object",
        properties: { pasta: { type: "string", description: "Nome da pasta. Ex: Desktop, Documentos, Downloads." } },
        required: ["pasta"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pesquisar_internet_avancada",
      description: "Pesquisa no buscador da web usando um navegador headless invisivel, ignora bloqueios e traz os links.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ler_pagina_web",
      description: "Acessa uma URL usando navegador invisivel e extrai o conteudo principal da pagina varrendo o HTML direto pra formato Markdown. Extremamente util para ler documentacoes e stackoverflow.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  // ─── Obsidian / Nero-brain ────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "ler_nota_obsidian",
      description: "Lê uma nota do Nero-brain (Obsidian). Use para consultar conhecimento já salvo, o perfil do usuário ou o histórico de conversas. Parâmetro pasta: nome da subpasta (ex: Perfil, Conversas, Base de Conhecimento). Parâmetro titulo: nome da nota sem extensao.",
      parameters: {
        type: "object",
        properties: {
          pasta: { type: "string", description: "Subpasta do Nero-brain: Perfil, Conversas, Base de Conhecimento, Aprendizado" },
          titulo: { type: "string", description: "Título da nota sem a extensão .md" },
        },
        required: ["pasta", "titulo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "salvar_nota_obsidian",
      description: "Cria ou atualiza uma nota no Nero-brain (Obsidian). Use para salvar aprendizados, notas de pesquisa, listas ou qualquer informação que deva ser lembrada. Parâmetro pasta: subpasta onde salvar. Parâmetro titulo: título da nota. Parâmetro conteudo: texto da nota em Markdown.",
      parameters: {
        type: "object",
        properties: {
          pasta: { type: "string", description: "Subpasta: Aprendizado, Base de Conhecimento, Perfil, ou nome personalizado" },
          titulo: { type: "string", description: "Título da nota" },
          conteudo: { type: "string", description: "Conteúdo da nota em Markdown" },
        },
        required: ["pasta", "titulo", "conteudo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_notas_obsidian",
      description: "Lista todas as notas de uma pasta do Nero-brain. Use para ver o que já está salvo no Obsidian.",
      parameters: {
        type: "object",
        properties: {
          pasta: { type: "string", description: "Subpasta do Nero-brain: Perfil, Conversas, Base de Conhecimento, Aprendizado" },
        },
        required: ["pasta"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "buscar_conhecimento",
      description: "Busca por um termo em todo o Nero-brain. Útil para encontrar notas relacionadas a um tópico antes de pesquisar na internet.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo ou frase para buscar no Nero-brain" },
        },
        required: ["query"],
      },
    },
  },
];

type ToolName = (typeof toolDefinitions)[number]["function"]["name"];

function buildPrintPath(): string {
  if (!fs.existsSync(PRINTS_DIR)) fs.mkdirSync(PRINTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(PRINTS_DIR, `Print_${stamp}.png`);
}

async function smartResolveWindowsPath(p: string): Promise<string> {
  if (os.platform() !== "win32") return path.resolve(p);
  
  const parts = p.split(/[\\/]+/);
  const knownFoldersMap: Record<string, string> = {
    "desktop": "desktop",
    "area de trabalho": "desktop",
    "área de trabalho": "desktop",
    "downloads": "downloads",
    "documentos": "documentos",
    "documents": "documentos",
    "imagens": "imagens",
    "pictures": "imagens",
    "vídeos": "videos",
    "videos": "videos",
    "músicas": "musicas",
    "musicas": "musicas"
  };

  for (let i = 0; i < parts.length; i++) {
    const partLower = parts[i].toLowerCase();
    if (knownFoldersMap[partLower]) {
      const isBase = i <= 3;
      if (isBase) {
        const realBasePath = await resolveWindowsKnownFolder(knownFoldersMap[partLower]);
        if (realBasePath) {
          const remainingParts = parts.slice(i + 1);
          return path.join(realBasePath, ...remainingParts);
        }
      }
    }
  }
  
  if (parts.length > 0 && parts[0] === "~") {
    const home = os.homedir();
    return path.join(home, ...parts.slice(1));
  }

  return path.resolve(p);
}

export async function capturarTelaAtual(): Promise<string> {
  const outPath = buildPrintPath();

  if (os.platform() !== "win32") {
    throw new Error("Captura de tela so no Windows por enquanto.");
  }

  const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save("${outPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;

  try {
    execFileSync("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 30000 });
  } catch (error) {
    throw new Error(`Erro captura: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!fs.existsSync(outPath)) {
    throw new Error("A captura foi executada, mas o arquivo nao foi encontrado.");
  }

  return outPath;
}

export async function executarFerramenta(name: ToolName, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "tocar_youtube": {
      const pesquisa = String(args.pesquisa ?? "");
      // Tenta encontrar um link de vídeo direto para tocar imediatamente
      const ddgQuery = `site:youtube.com watch ${pesquisa}`;
      const videoUrl = await findFirstUrlOnDuckDuckGo(ddgQuery);
      if (videoUrl && videoUrl.includes("youtube.com/watch")) {
        await open(videoUrl);
        return `Tocando '${pesquisa}' no YouTube!`;
      }
      // Fallback: se não achar, abre a página de busca como antes
      const q = encodeURIComponent(pesquisa);
      const url = `https://www.youtube.com/results?search_query=${q}`;
      await open(url);
      return `Não achei um vídeo direto. Abrindo a busca do YouTube para '${pesquisa}'.`;
    }
    case "controlar_midia": {
      const acao = String(args.acao ?? "").toLowerCase();
      if (acao.includes("play_pause")) {
        enviarTeclaMidiaVirtualKey(VK.MEDIA_PLAY_PAUSE);
        return "Play/Pause executado.";
      }
      if (acao.includes("proximo")) {
        enviarTeclaMidiaVirtualKey(VK.MEDIA_NEXT);
        return "Próxima faixa.";
      }
      if (acao.includes("anterior")) {
        enviarTeclaMidiaVirtualKey(VK.MEDIA_PREV);
        return "Faixa anterior.";
      }
      return `Ação de mídia '${args.acao}' não suportada.`;
    }
    case "esconder_todas_janelas": {
      if (os.platform() !== "win32") return "Só disponível no Windows.";
      try {
        execFileSync(
          "powershell",
          ["-NoProfile", "-Command", `(New-Object -ComObject Shell.Application).MinimizeAll()`],
          { windowsHide: true, timeout: 10000 }
        );
        return "Janelas minimizadas (área de trabalho limpa).";
      } catch (e) {
        return `Erro ao minimizar janelas: ${e}`;
      }
    }
    case "restaurar_todas_janelas": {
      if (os.platform() !== "win32") return "Só disponível no Windows.";
      try {
        execFileSync(
          "powershell",
          ["-NoProfile", "-Command", `(New-Object -ComObject Shell.Application).UndoMinimizeALL()`],
          { windowsHide: true, timeout: 10000 }
        );
        return "Tentei restaurar janelas minimizadas.";
      } catch (e) {
        return `Erro: ${e}`;
      }
    }
    case "alternar_janelas":
      enviarWinD();
      return "Win+D alternado.";
    case "minimizar_programa": {
      const nome = String(args.nome ?? "").trim();
      const count = await alterarJanelaProgramaWindows(nome, "minimizar");
      if (count > 0) {
        return count === 1
          ? `Minimizei a janela do programa '${nome}'.`
          : `Minimizei ${count} janelas do programa '${nome}'.`;
      }
      return `Nao encontrei janela visivel para o programa '${nome}'.`;
    }
    case "restaurar_programa": {
      const nome = String(args.nome ?? "").trim();
      const count = await alterarJanelaProgramaWindows(nome, "restaurar");
      if (count > 0) {
        return count === 1
          ? `Restaurei a janela do programa '${nome}'.`
          : `Restaurei ${count} janelas do programa '${nome}'.`;
      }
      return `Nao encontrei janela para restaurar do programa '${nome}'.`;
    }
    case "alterar_volume": {
      const acao = String(args.acao ?? "").toLowerCase();
      if (["aumentar", "mais", "up", "aumenta"].some((x) => acao.includes(x))) {
        for (let i = 0; i < 5; i++) enviarTeclaMidiaVirtualKey(VK.VOLUME_UP);
        return "Volume aumentado.";
      }
      if (["diminuir", "menos", "down", "abaixar", "diminui"].some((x) => acao.includes(x))) {
        for (let i = 0; i < 5; i++) enviarTeclaMidiaVirtualKey(VK.VOLUME_DOWN);
        return "Volume reduzido.";
      }
      if (["mutar", "mudo", "mute"].some((x) => acao.includes(x))) {
        enviarTeclaMidiaVirtualKey(VK.VOLUME_MUTE);
        return "Mute alternado.";
      }
      return `Ação '${args.acao}' não reconhecida.`;
    }
    case "obter_data_hora": {
      const agora = new Date();
      const dias = [
        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado",
      ];
      return `Hoje é ${dias[agora.getDay()]}, ${agora.toLocaleString("pt-BR")}.`;
    }
    case "obter_clima": {
      const cidade = String(args.cidade ?? "");
      try {
        const t = await httpGetText(`https://wttr.in/${encodeURIComponent(cidade)}?format=3`);
        return `Clima: ${t.trim()}`;
      } catch (e) {
        return `Erro ao consultar clima: ${e}`;
      }
    }
    case "ler_noticias_dia": {
      const text = await pesquisarDuckDuckGo("notícias Brasil hoje", 5);
      return text || "Não encontrei notícias agora. Tente pedir uma pesquisa específica.";
    }
    case "pesquisar_web": {
      const query = String(args.query ?? "");
      const text = await pesquisarDuckDuckGo(query, 4);
      return text || `Nenhum resultado curto para '${query}'. Abra o navegador para ver mais.`;
    }
    case "abrir_navegador": {
      let url = String(args.url ?? "");
      if (!url.startsWith("http")) url = `https://${url}`;
      await open(url);
      return `Navegador aberto: ${url}`;
    }
    case "abrir_pasta": {
      const nome = String(args.nome ?? "");
      const dentroDe = String(args.dentro_de ?? "");
      const found = await localizarPastaWindows(nome, dentroDe);
      if (!found) {
        if (dentroDe.trim()) {
          return `Nao encontrei a pasta '${nome}' dentro de '${dentroDe}'.`;
        }
        return `Nao encontrei a pasta '${nome}'.`;
      }
      await open(found);
      return `Pasta aberta: ${found}`;
    }
    case "fechar_pasta": {
      const nome = String(args.nome ?? "");
      const dentroDe = String(args.dentro_de ?? "");
      const found = await localizarPastaWindows(nome, dentroDe);
      if (!found) {
        if (dentroDe.trim()) {
          return `Nao encontrei a pasta '${nome}' dentro de '${dentroDe}'.`;
        }
        return `Nao encontrei a pasta '${nome}'.`;
      }
      const closedCount = await fecharJanelaDaPastaWindows(found);
      if (closedCount > 0) {
        return closedCount === 1
          ? `Fechei a janela da pasta: ${found}`
          : `Fechei ${closedCount} janelas da pasta: ${found}`;
      }
      return `A pasta '${found}' nao estava aberta em nenhuma janela do Explorer.`;
    }
    case "abrir_programa": {
      const nome = String(args.nome ?? "").toLowerCase().trim();
      const programas: Record<string, string> = {
        calculadora: "calc",
        "bloco de notas": "notepad",
        notepad: "notepad",
        paint: "mspaint",
        explorador: "explorer",
        explorer: "explorer",
        cmd: "cmd",
        terminal: "wt",
        configurações: "ms-settings:",
        configuracoes: "ms-settings:",
      };
      const cmd = programas[nome] ?? nome;
      try {
        if (cmd.includes(":")) {
          await open(cmd);
        } else {
          spawn(cmd, [], { shell: true, detached: true, stdio: "ignore" }).unref();
        }
        return `Programa '${args.nome}' iniciado.`;
      } catch (e) {
        return `Erro ao abrir: ${e}`;
      }
    }
    case "fechar_programa": {
      if (os.platform() !== "win32") return "Fechar programa só está implementado no Windows.";
      const nome = String(args.nome ?? "").toLowerCase().trim();
      const programas: Record<string, string> = {
        calculadora: "CalculatorApp.exe",
        "bloco de notas": "notepad.exe",
        notepad: "notepad.exe",
        paint: "mspaint.exe",
        explorador: "explorer.exe",
        explorer: "explorer.exe",
        cmd: "cmd.exe",
        terminal: "WindowsTerminal.exe",
        configurações: "SystemSettings.exe",
        configuracoes: "SystemSettings.exe",
      };
      let proc = programas[nome] ?? `${nome}.exe`;
      if (!proc.endsWith(".exe")) proc = `${proc}.exe`;
      try {
        await execFileAsync("taskkill", ["/F", "/IM", proc, "/T"], { windowsHide: true });
        return `Programa '${args.nome}' fechado.`;
      } catch {
        if (nome === "calculadora") {
          try {
            await execFileAsync("taskkill", ["/F", "/IM", "calc.exe", "/T"], { windowsHide: true });
            return "Calculadora fechada.";
          } catch {
            /* */
          }
        }
        return `Não foi possível fechar '${args.nome}'.`;
      }
    }
    case "capturar_tela": {
      if (!fs.existsSync(PRINTS_DIR)) fs.mkdirSync(PRINTS_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outPath = path.join(PRINTS_DIR, `Print_${stamp}.png`);
      if (os.platform() === "win32") {
        const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save("${outPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;
        try {
          execFileSync("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 30000 });
          return `Print salvo em: ${outPath}`;
        } catch (e) {
          return `Erro captura: ${e}`;
        }
      }
      return "Captura de tela só no Windows por enquanto.";
    }
    case "criar_anotacao": {
      const texto = String(args.texto ?? "");
      const linha = `[${new Date().toLocaleString("pt-BR")}] ${texto}\n`;
      fs.appendFileSync(ANOTACOES_FILE, linha, "utf-8");
      return `Anotação salva: '${texto}'`;
    }
    case "obter_musica_atual":
      return await obterMusicaAtualWindows();
    case "executar_comando_terminal": {
      const comando = String(args.comando ?? "");
      try {
        const { stdout, stderr } = await execFileAsync("powershell", ["-NoProfile", "-Command", comando], { 
          encoding: "utf-8",
          windowsHide: true,
          timeout: 45000 
        });
        const output = stdout.trim() || stderr.trim() || "Comando executado sem retorno visual.";
        return `Comando executado:\n${output.slice(0, 1500)}`;
      } catch (e) {
        return `Erro no comando: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "ler_arquivo": {
      let caminho = String(args.caminho ?? "");
      try {
        caminho = await smartResolveWindowsPath(caminho);
        const txt = fs.readFileSync(path.resolve(caminho), "utf-8");
        return `Conteúdo de ${path.basename(caminho)}:\n${txt.slice(0, 3000)}`;
      } catch (e) {
        return `Erro ao ler arquivo: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "escrever_arquivo": {
      let caminho = String(args.caminho ?? "");
      const conteudo = String(args.conteudo ?? "");
      try {
        caminho = await smartResolveWindowsPath(caminho);
        fs.mkdirSync(path.dirname(path.resolve(caminho)), { recursive: true });
        fs.writeFileSync(path.resolve(caminho), conteudo, "utf-8");
        return `Arquivo ${path.basename(caminho)} gravado com sucesso.`;
      } catch (e) {
        return `Erro ao escrever arquivo: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "obter_local_pasta": {
      const pasta = String(args.pasta ?? "");
      const found = await resolveWindowsKnownFolder(pasta);
      if (found) {
        return `O caminho exato da pasta '${pasta}' é: ${found}`;
      }
      return `Não foi possível encontrar o caminho padrão para '${pasta}'. Talvez você precise buscar manualmente.`;
    }
    case "pesquisar_internet_avancada": {
      const query = String(args.query ?? "");
      return await pesquisarDuckDuckGoNodeless(query);
    }
    case "ler_pagina_web": {
      const url = String(args.url ?? "");
      return await lerPaginaWebComoMarkdown(url);
    }
    // ─── Obsidian / Nero-brain ────────────────────────────────────────
    case "ler_nota_obsidian": {
      const pasta = String(args.pasta ?? "");
      const titulo = String(args.titulo ?? "");
      const conteudo = lerNota(pasta, titulo);
      if (!conteudo) return `Nota '${titulo}' não encontrada em ${pasta}.`;
      return `📄 **${pasta}/${titulo}**\n\n${conteudo.slice(0, 3000)}`;
    }
    case "salvar_nota_obsidian": {
      const pasta = String(args.pasta ?? "");
      const titulo = String(args.titulo ?? "");
      const conteudo = String(args.conteudo ?? "");
      if (!pasta || !titulo || !conteudo) {
        return "Erro: pasta, titulo e conteudo são obrigatórios.";
      }
      try {
        const arquivo = salvarNota(pasta, titulo, conteudo, {
          criado: new Date().toISOString().split("T")[0]!,
          tipo: "nota",
          tags: ["nero", pasta.toLowerCase()],
        });
        return `✅ Nota '${titulo}' salva em ${pasta}. Você pode ver no Obsidian (${arquivo}).`;
      } catch (e) {
        return `Erro ao salvar nota: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "listar_notas_obsidian": {
      const pasta = String(args.pasta ?? "");
      const notas = listarNotas(pasta);
      if (!notas.length) return `Nenhuma nota encontrada em '${pasta}'.`;
      return `📂 **${pasta}** (${notas.length} nota(s)):\n\n${notas.map((n) => `- [[${n}]]`).join("\n")}`;
    }
    case "buscar_conhecimento": {
      const query = String(args.query ?? "");
      return buscarNoCofre(query);
    }
    default:
      console.warn(`⚠️ Ferramenta solicitada pelo modelo não existe no código: ${name}`);
      return `Ferramenta desconhecida: ${name}`;
  }
}

function normalizeFolderName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeFolderPath(value: string): boolean {
  const trimmed = value.trim();
  return path.isAbsolute(trimmed) || trimmed.includes("\\") || trimmed.includes("/");
}

function existingDirectory(candidate: string): string | null {
  try {
    const resolved = path.resolve(candidate);
    if (fs.statSync(resolved).isDirectory()) return resolved;
  } catch {
    /* noop */
  }
  return null;
}

async function resolveWindowsKnownFolder(name: string): Promise<string | null> {
  const normalized = normalizeFolderName(name);
  if (!normalized) return null;

  const home = os.homedir();
  const fromCandidates = (candidates: string[]): string | null => {
    for (const candidate of candidates) {
      const found = existingDirectory(candidate);
      if (found) return found;
    }
    return null;
  };
  const fromPowerShellFolder = async (specialFolder: string, fallbacks: string[]): Promise<string | null> => {
    try {
      const { stdout } = await execFileAsync(
        "powershell",
        ["-NoProfile", "-Command", `[Environment]::GetFolderPath('${specialFolder}')`],
        { encoding: "utf-8", windowsHide: true, timeout: 4000 }
      );
      const psPath = existingDirectory(stdout.trim());
      if (psPath) return psPath;
    } catch {
      /* noop */
    }
    return fromCandidates(fallbacks);
  };

  if (["documentos", "documento", "meus documentos", "documents", "docs"].includes(normalized)) {
    return fromPowerShellFolder("MyDocuments", [path.join(home, "Documents"), path.join(home, "Documentos")]);
  }
  if (["desktop", "area de trabalho", "mesa"].includes(normalized)) {
    return fromPowerShellFolder("Desktop", [
      path.join(home, "Desktop"),
      path.join(home, "Area de Trabalho"),
      path.join(home, "Área de Trabalho"),
    ]);
  }
  if (["downloads", "download", "baixados"].includes(normalized)) {
    return fromCandidates([path.join(home, "Downloads"), path.join(home, "Baixados")]);
  }
  if (["imagens", "imagem", "fotos", "pictures"].includes(normalized)) {
    return fromPowerShellFolder("MyPictures", [path.join(home, "Pictures"), path.join(home, "Imagens")]);
  }
  if (["videos", "video", "filmes", "movies"].includes(normalized)) {
    return fromPowerShellFolder("MyVideos", [path.join(home, "Videos"), path.join(home, "Video")]);
  }
  if (["musicas", "musica", "music", "audio", "audios"].includes(normalized)) {
    return fromPowerShellFolder("MyMusic", [path.join(home, "Music"), path.join(home, "Musicas"), path.join(home, "Músicas")]);
  }
  if (["usuario", "pasta pessoal", "home", "perfil"].includes(normalized)) {
    return existingDirectory(home);
  }

  if (looksLikeFolderPath(name)) {
    return existingDirectory(name);
  }

  return null;
}

function isSubPath(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function chooseBestFolderMatch(matches: string[]): string | null {
  if (!matches.length) return null;
  return [...matches].sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? null;
}

function findFolderInsideBase(basePath: string, targetName: string): string | null {
  const normalizedTarget = normalizeFolderName(targetName);
  if (!normalizedTarget) return null;

  if (normalizeFolderName(path.basename(basePath)) === normalizedTarget) {
    return basePath;
  }

  const queue = [basePath];
  const exactMatches: string[] = [];
  const partialMatches: string[] = [];
  let scannedDirs = 0;
  const maxScannedDirs = 12000;

  while (queue.length > 0 && scannedDirs < maxScannedDirs) {
    const current = queue.shift();
    if (!current) break;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const fullPath = path.join(current, entry.name);
      scannedDirs += 1;

      const normalizedEntry = normalizeFolderName(entry.name);
      if (normalizedEntry === normalizedTarget) exactMatches.push(fullPath);
      else if (normalizedEntry.includes(normalizedTarget)) partialMatches.push(fullPath);

      if (scannedDirs < maxScannedDirs) {
        queue.push(fullPath);
      }
    }
  }

  return chooseBestFolderMatch(exactMatches) ?? chooseBestFolderMatch(partialMatches);
}

async function localizarPastaWindows(nome: string, dentroDe: string): Promise<string | null> {
  if (os.platform() !== "win32") return null;

  const requestedName = nome.trim();
  const baseHint = dentroDe.trim();
  if (!requestedName) return null;

  const directPath = existingDirectory(requestedName);
  if (directPath) return directPath;

  if (!baseHint) {
    return await resolveWindowsKnownFolder(requestedName);
  }

  const basePath = (await resolveWindowsKnownFolder(baseHint)) ?? existingDirectory(baseHint);
  if (!basePath) return null;

  const directInsideBase = existingDirectory(path.join(basePath, requestedName));
  if (directInsideBase) return directInsideBase;

  const knownFolder = await resolveWindowsKnownFolder(requestedName);
  if (knownFolder && isSubPath(basePath, knownFolder)) {
    return knownFolder;
  }

  return findFolderInsideBase(basePath, requestedName);
}

async function fecharJanelaDaPastaWindows(targetPath: string): Promise<number> {
  if (os.platform() !== "win32") return 0;

  const escapedTargetPath = targetPath.replace(/'/g, "''");
  const ps = `
$target = '${escapedTargetPath}'
$shell = New-Object -ComObject Shell.Application
$closed = 0
foreach ($window in @($shell.Windows())) {
  try {
    $document = $window.Document
    if (-not $document) { continue }
    $folder = $document.Folder
    if (-not $folder) { continue }
    $self = $folder.Self
    if (-not $self) { continue }
    $windowPath = $self.Path
    if ($windowPath -and [string]::Equals($windowPath, $target, [System.StringComparison]::OrdinalIgnoreCase)) {
      $window.Quit()
      $closed++
    }
  } catch {
    # ignora janelas nao relacionadas ao Explorer
  }
}
Write-Output $closed
`;

  try {
    const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", ps], {
      encoding: "utf-8",
      windowsHide: true,
      timeout: 12000,
    });
    const count = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(count) ? count : 0;
  } catch {
    return 0;
  }
}

function normalizeProgramName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveProgramSearchTerms(name: string): string[] {
  const normalized = normalizeProgramName(name);
  const aliasMap: Record<string, string[]> = {
    calculadora: ["calculator", "calc"],
    calc: ["calculator", "calc"],
    "bloco de notas": ["notepad"],
    notepad: ["notepad"],
    paint: ["mspaint", "paint"],
    explorador: ["explorer", "file explorer"],
    explorer: ["explorer", "file explorer"],
    chrome: ["chrome", "google chrome"],
    "google chrome": ["chrome", "google chrome"],
    edge: ["msedge", "edge", "microsoft edge"],
    "microsoft edge": ["msedge", "edge", "microsoft edge"],
    firefox: ["firefox"],
    opera: ["opera"],
    terminal: ["windows terminal", "terminal", "wt"],
    "windows terminal": ["windows terminal", "terminal", "wt"],
    cmd: ["cmd", "prompt de comando", "command prompt"],
    "prompt de comando": ["cmd", "command prompt"],
    vscode: ["code", "vs code", "visual studio code", "vscode"],
    "vs code": ["code", "vs code", "visual studio code", "vscode"],
    "visual studio code": ["code", "vs code", "visual studio code", "vscode"],
  };

  const terms = new Set<string>();
  if (normalized) terms.add(normalized);
  for (const candidate of aliasMap[normalized] ?? []) terms.add(candidate);
  return [...terms];
}

async function alterarJanelaProgramaWindows(nome: string, acao: "minimizar" | "restaurar"): Promise<number> {
  if (os.platform() !== "win32") return 0;

  const terms = resolveProgramSearchTerms(nome);
  if (!terms.length) return 0;

  const escapedTerms = terms.map((term) => `'${term.replace(/'/g, "''")}'`).join(", ");
  const commandValue = acao === "restaurar" ? 9 : 6;
  const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NeroWinApi {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@
$terms = @(${escapedTerms})
$command = ${commandValue}
$count = 0
Get-Process | ForEach-Object {
  try {
    if ($_.MainWindowHandle -eq 0) { return }
    $procName = $_.ProcessName.ToLowerInvariant()
    $title = if ($_.MainWindowTitle) { $_.MainWindowTitle.ToLowerInvariant() } else { "" }
    $match = $false
    foreach ($term in $terms) {
      if (($procName.Contains($term)) -or ($title.Contains($term))) {
        $match = $true
        break
      }
    }
    if ($match) {
      [NeroWinApi]::ShowWindowAsync($_.MainWindowHandle, $command) | Out-Null
      $count++
    }
  } catch {
    # ignora processos sem janela controlavel
  }
}
Write-Output $count
`;

  try {
    const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", ps], {
      encoding: "utf-8",
      windowsHide: true,
      timeout: 12000,
    });
    const count = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(count) ? count : 0;
  } catch {
    return 0;
  }
}

function enviarWinD(): void {
  if (os.platform() !== "win32") return;
  const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
$KEY_UP = 0x0002; # Flag para soltar a tecla
# Simula Win + D
[K]::keybd_event(0x5B, 0, 0, [UIntPtr]::Zero)      # Win Key Down
[K]::keybd_event(0x44, 0, 0, [UIntPtr]::Zero)      # D Key Down
[K]::keybd_event(0x44, 0, $KEY_UP, [UIntPtr]::Zero) # D Key Up
[K]::keybd_event(0x5B, 0, $KEY_UP, [UIntPtr]::Zero) # Win Key Up
`;
  try {
    execFileSync("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 5000 });
  } catch {
    /* */
  }
}

async function findFirstUrlOnDuckDuckGo(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const raw = await httpGetText(url, 4000);
    const j = JSON.parse(raw) as {
      Redirect?: string;
      RelatedTopics?: Array<{
        FirstURL?: string;
        Topics?: Array<{ FirstURL?: string }>;
      }>;
    };
    if (j.Redirect) return j.Redirect;
    const topics = j.RelatedTopics ?? [];
    for (const topic of topics) {
      if (topic.FirstURL) return topic.FirstURL;
      if (Array.isArray(topic.Topics)) {
        for (const subTopic of topic.Topics) {
          if (subTopic.FirstURL) return subTopic.FirstURL;
        }
      }
    }
  } catch (e) {
    console.warn(`Error in findFirstUrlOnDuckDuckGo for query "${query}":`, e);
  }
  return "";
}

async function pesquisarDuckDuckGo(query: string, maxSnippets: number): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const raw = await httpGetText(url);
    const j = JSON.parse(raw) as {
      AbstractText?: string;
      RelatedTopics?: Array<{ Text?: string; Topics?: Array<{ Text?: string }> }>;
    };
    const parts: string[] = [];
    if (j.AbstractText) parts.push(j.AbstractText);
    const rel = j.RelatedTopics ?? [];
    for (const r of rel) {
      if (parts.length >= maxSnippets) break;
      if (typeof r === "object" && r && "Text" in r && r.Text) parts.push(r.Text);
      else if (typeof r === "object" && r && "Topics" in r && Array.isArray(r.Topics)) {
        for (const t of r.Topics) {
          if (parts.length >= maxSnippets) break;
          if (t.Text) parts.push(t.Text);
        }
      }
    }
    if (parts.length) return `Resultados para '${query}': ${parts.join(" | ").slice(0, 1200)}`;
  } catch {
    /* */
  }
  return "";
}

async function obterMusicaAtualWindows(): Promise<string> {
  if (os.platform() !== "win32") return "Só disponível no Windows.";
  const ps = `
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
  function Await($winRtTask) { $asTask = $asTaskGeneric.MakeGenericMethod($winRtTask.GetType().GetGenericArguments()[0]); $netTask = $asTask.Invoke($null, @($winRtTask)); $netTask.Wait(-1) | Out-Null; $netTask.Result }
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
  $mgr = Await([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
  $s = $mgr.GetCurrentSession()
  if (-not $s) { "Nada tocando."; exit }
  $async = $s.TryGetMediaPropertiesAsync()
  $mp = Await($async)
  $t = $mp.Title
  $a = $mp.Artist
  if ($t -and $a) { "A música atual é '$t' — '$a'" }
  elseif ($t) { "Está tocando: '$t'" }
  else { "Mídia ativa sem metadados." }
} catch { "Não consegui ler a mídia atual. $_" }
`;
  try {
    const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Sta", "-Command", ps], {
      encoding: "utf-8",
      windowsHide: true,
      timeout: 12000,
    });
    return stdout.trim() || "Sem informação de mídia.";
  } catch (e) {
    return `Não consegui obter música atual. Instale/atualize componentes de mídia ou tente de novo. ${e}`;
  }
}

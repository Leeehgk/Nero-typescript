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
      description: "Minimiza janelas visíveis (área de trabalho limpa).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restaurar_todas_janelas",
      description: "Restaura janelas minimizadas pela ferramenta anterior.",
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
      name: "abrir_programa",
      description: "Abre programa Windows (calculadora, notepad, paint, etc.).",
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
      description: "Fecha um programa pelo nome.",
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
      description: "Salva screenshot em Prints/",
      parameters: { type: "object", properties: {} },
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
];

type ToolName = (typeof toolDefinitions)[number]["function"]["name"];

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
    default:
      return "Ferramenta desconhecida.";
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

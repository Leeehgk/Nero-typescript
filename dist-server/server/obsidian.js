/**
 * obsidian.ts — Ponte entre o Nero e o cofre Obsidian (Nero-brain)
 *
 * Responsabilidades:
 *  - Ler / gravar notas Markdown no Nero-brain
 *  - Sincronizar o perfil do usuário com Nero-brain/Perfil/Usuário.md
 *  - Salvar resumos de sessão em Nero-brain/Conversas/YYYY-MM-DD.md
 *  - Salvar conhecimento pesquisado em Nero-brain/Base de Conhecimento/
 *  - Busca por texto dentro do cofre (sem LLM)
 *  - Extração local de fatos por regex (sem gastar tokens de LLM)
 */
import fs from "node:fs";
import path from "node:path";
import { NERO_BRAIN_DIR, OB_PERFIL_DIR, OB_CONVERSAS_DIR, OB_CONHECIMENTO_DIR, OB_APRENDIZADO_DIR, } from "./paths.js";
// ─────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────
function garantirDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function sanitizarNomeArquivo(nome) {
    return nome
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}
function dataHojeISO() {
    return new Date().toISOString().split("T")[0];
}
function dataHojePtBR() {
    return new Date().toLocaleDateString("pt-BR");
}
function timestampPtBR() {
    return new Date().toLocaleString("pt-BR");
}
function construirFrontmatter(campos) {
    const linhas = ["---"];
    for (const [chave, valor] of Object.entries(campos)) {
        if (Array.isArray(valor)) {
            linhas.push(`${chave}: [${valor.map((v) => `"${v}"`).join(", ")}]`);
        }
        else {
            linhas.push(`${chave}: ${valor}`);
        }
    }
    linhas.push("---");
    return linhas.join("\n");
}
// ─────────────────────────────────────────────────────────────
// API Pública — Operações de Nota
// ─────────────────────────────────────────────────────────────
/** Lê o conteúdo de uma nota do Nero-brain. Retorna null se não existir. */
export function lerNota(pastaNome, titulo) {
    const pasta = path.join(NERO_BRAIN_DIR, pastaNome);
    const arquivo = path.join(pasta, `${sanitizarNomeArquivo(titulo)}.md`);
    try {
        if (fs.existsSync(arquivo)) {
            return fs.readFileSync(arquivo, "utf-8");
        }
    }
    catch (e) {
        console.warn(`⚠️ [Obsidian] Erro ao ler nota '${titulo}':`, e);
    }
    return null;
}
/** Grava (cria ou sobrescreve) uma nota no Nero-brain. */
export function salvarNota(pastaNome, titulo, conteudo, frontmatter) {
    const pasta = path.join(NERO_BRAIN_DIR, pastaNome);
    garantirDir(pasta);
    const arquivo = path.join(pasta, `${sanitizarNomeArquivo(titulo)}.md`);
    const fm = frontmatter ? construirFrontmatter(frontmatter) + "\n\n" : "";
    const textoFinal = `${fm}${conteudo}`;
    try {
        fs.writeFileSync(arquivo, textoFinal, "utf-8");
        console.log(`📝 [Obsidian] Nota salva: ${pastaNome}/${titulo}.md`);
        return arquivo;
    }
    catch (e) {
        console.warn(`⚠️ [Obsidian] Erro ao salvar nota '${titulo}':`, e);
        throw e;
    }
}
/** Lista todas as notas (sem extensão) de uma pasta do Nero-brain. */
export function listarNotas(pastaNome) {
    const pasta = path.join(NERO_BRAIN_DIR, pastaNome);
    if (!fs.existsSync(pasta))
        return [];
    try {
        return fs
            .readdirSync(pasta)
            .filter((f) => f.endsWith(".md"))
            .map((f) => f.replace(/\.md$/, ""))
            .sort();
    }
    catch (e) {
        console.warn(`⚠️ [Obsidian] Erro ao listar pasta '${pastaNome}':`, e);
        return [];
    }
}
/** Busca texto em todo o Nero-brain. Retorna trechos relevantes. */
export function buscarNoCofre(query, maxResultados = 8) {
    const queryLower = query.toLowerCase();
    const resultados = [];
    function varrerDiretorio(dir, relativo) {
        if (!fs.existsSync(dir))
            return;
        const itens = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of itens) {
            if (resultados.length >= maxResultados)
                return;
            const caminhoCompleto = path.join(dir, item.name);
            if (item.isDirectory() && !item.name.startsWith(".")) {
                varrerDiretorio(caminhoCompleto, `${relativo}/${item.name}`);
            }
            else if (item.isFile() && item.name.endsWith(".md")) {
                try {
                    const conteudo = fs.readFileSync(caminhoCompleto, "utf-8");
                    if (conteudo.toLowerCase().includes(queryLower)) {
                        // Extrai trecho com contexto
                        const linhas = conteudo.split("\n");
                        const linhaMatch = linhas.find((l) => l.toLowerCase().includes(queryLower));
                        const trecho = linhaMatch ? linhaMatch.trim().slice(0, 200) : conteudo.slice(0, 200);
                        resultados.push({
                            arquivo: `${relativo}/${item.name.replace(/\.md$/, "")}`,
                            trecho,
                        });
                    }
                }
                catch {
                    /* ignora */
                }
            }
        }
    }
    varrerDiretorio(NERO_BRAIN_DIR, "Nero-brain");
    if (!resultados.length)
        return `Nenhuma nota encontrada para '${query}' no Nero-brain.`;
    return (`🔍 Encontrei ${resultados.length} nota(s) para '${query}':\n\n` +
        resultados.map((r) => `📄 **${r.arquivo}**\n> ${r.trecho}`).join("\n\n"));
}
// ─────────────────────────────────────────────────────────────
// Perfil do Usuário — Sincronização com Obsidian
// ─────────────────────────────────────────────────────────────
/** Agrupa fatos em categorias para o Markdown do perfil. */
function categorizarFatos(fatos) {
    const categorias = {
        "Identificação": [],
        "Informações Pessoais": [],
        "Preferências": [],
        "Hábitos e Rotinas": [],
        "Outros": [],
    };
    const regrasCategoria = [
        { regex: /\b(nome|chamad[ao]|apelido|chefe|ângela|angela)\b/i, categoria: "Identificação" },
        { regex: /\b(profissão|profissao|trabalh|cabeleireiro|bebê|bebe|filho|filha|mãe|mae|família|familia|financiamento|banco)\b/i, categoria: "Informações Pessoais" },
        { regex: /\b(gosta|prefere|adora|odeia|favorit)\b/i, categoria: "Preferências" },
        { regex: /\b(rotina|hábito|habito|costume|sempre|todo dia|domingo|semana)\b/i, categoria: "Hábitos e Rotinas" },
    ];
    for (const fato of fatos) {
        // Filtra fatos genéricos sem informação real
        if (fato.includes("não há informações novas") ||
            fato.includes("nao ha informacoes novas") ||
            fato.length < 10)
            continue;
        let categorizado = false;
        for (const { regex, categoria } of regrasCategoria) {
            if (regex.test(fato)) {
                categorias[categoria].push(fato);
                categorizado = true;
                break;
            }
        }
        if (!categorizado)
            categorias["Outros"].push(fato);
    }
    return categorias;
}
/** Sincroniza o perfil_nero.json → Nero-brain/Perfil/Usuário.md */
export function atualizarPerfilObsidian(fatos) {
    const categorias = categorizarFatos(fatos);
    const linhas = [];
    linhas.push(construirFrontmatter({
        tipo: "perfil",
        atualizado: dataHojeISO(),
        tags: ["perfil", "usuário", "nero"],
    }));
    linhas.push("");
    linhas.push("# Perfil do Usuário");
    linhas.push("");
    linhas.push(`> Última atualização: ${timestampPtBR()}`);
    linhas.push("");
    for (const [categoria, itens] of Object.entries(categorias)) {
        if (!itens.length)
            continue;
        linhas.push(`## ${categoria}`);
        for (const item of itens) {
            linhas.push(`- ${item}`);
        }
        linhas.push("");
    }
    garantirDir(OB_PERFIL_DIR);
    const arquivo = path.join(OB_PERFIL_DIR, "Usuário.md");
    try {
        fs.writeFileSync(arquivo, linhas.join("\n"), "utf-8");
        console.log(`🧠 [Obsidian] Perfil sincronizado: ${fatos.length} fato(s)`);
    }
    catch (e) {
        console.warn("⚠️ [Obsidian] Erro ao atualizar perfil:", e);
    }
}
/** Gera um resumo local da sessão (sem LLM) e salva no Obsidian. */
export function salvarResumoSessao(mensagens) {
    if (!mensagens.length)
        return;
    const hoje = dataHojeISO();
    const hojeFormatado = dataHojePtBR();
    // Extrai os primeiros turnos do usuário para ter uma ideia dos assuntos
    const turnosUsuario = mensagens
        .filter((m) => m.role === "user")
        .map((m) => m.content.trim())
        .filter((t) => t.length > 5)
        .slice(0, 10);
    // Detecta tópicos mencionados (simples heurística)
    const topicosDetectados = extrairTopicosLocalmente(turnosUsuario.join(" "));
    const linhas = [];
    linhas.push(construirFrontmatter({
        data: hoje,
        tipo: "conversa",
        tags: ["conversa", "sessão", ...topicosDetectados.slice(0, 5)],
    }));
    linhas.push("");
    linhas.push(`# Sessão de Chat — ${hojeFormatado}`);
    linhas.push("");
    linhas.push(`**Total de mensagens:** ${mensagens.length}`);
    linhas.push(`**Horário:** ${timestampPtBR()}`);
    linhas.push("");
    if (topicosDetectados.length) {
        linhas.push("## Tópicos Abordados");
        for (const t of topicosDetectados) {
            linhas.push(`- ${t}`);
        }
        linhas.push("");
    }
    if (turnosUsuario.length) {
        linhas.push("## Resumo das Mensagens");
        for (const turno of turnosUsuario.slice(0, 6)) {
            linhas.push(`- ${turno.slice(0, 150)}`);
        }
        linhas.push("");
    }
    garantirDir(OB_CONVERSAS_DIR);
    // Se já existe nota do dia, faz append de nova sessão
    const arquivo = path.join(OB_CONVERSAS_DIR, `${hoje}.md`);
    if (fs.existsSync(arquivo)) {
        const adicional = `\n\n---\n\n## Nova Sessão — ${timestampPtBR()}\n\n` +
            turnosUsuario.slice(0, 4).map((t) => `- ${t.slice(0, 150)}`).join("\n");
        try {
            fs.appendFileSync(arquivo, adicional, "utf-8");
        }
        catch (e) {
            console.warn("⚠️ [Obsidian] Erro ao atualizar sessão do dia:", e);
        }
    }
    else {
        try {
            fs.writeFileSync(arquivo, linhas.join("\n"), "utf-8");
            console.log(`📅 [Obsidian] Sessão salva: Conversas/${hoje}.md`);
        }
        catch (e) {
            console.warn("⚠️ [Obsidian] Erro ao salvar sessão:", e);
        }
    }
}
// ─────────────────────────────────────────────────────────────
// Base de Conhecimento
// ─────────────────────────────────────────────────────────────
/** Salva conteúdo pesquisado na Base de Conhecimento do Obsidian. */
export function salvarConhecimento(titulo, conteudo, tags = []) {
    garantirDir(OB_CONHECIMENTO_DIR);
    const tituloSanitizado = sanitizarNomeArquivo(titulo);
    const arquivo = path.join(OB_CONHECIMENTO_DIR, `${tituloSanitizado}.md`);
    // Se já existe, não sobrescreve — só atualiza o "última consulta"
    if (fs.existsSync(arquivo)) {
        try {
            const existente = fs.readFileSync(arquivo, "utf-8");
            const atualizado = existente.replace(/ultima_consulta: .*/, `ultima_consulta: ${dataHojeISO()}`);
            fs.writeFileSync(arquivo, atualizado, "utf-8");
        }
        catch {
            /* ignora */
        }
        return;
    }
    const fm = construirFrontmatter({
        tipo: "conhecimento",
        criado: dataHojeISO(),
        ultima_consulta: dataHojeISO(),
        tags: ["conhecimento", ...tags],
    });
    const texto = `${fm}\n\n# ${titulo}\n\n${conteudo.slice(0, 4000)}`;
    try {
        fs.writeFileSync(arquivo, texto, "utf-8");
        console.log(`💡 [Obsidian] Conhecimento salvo: ${tituloSanitizado}`);
    }
    catch (e) {
        console.warn(`⚠️ [Obsidian] Erro ao salvar conhecimento '${titulo}':`, e);
    }
}
// ─────────────────────────────────────────────────────────────
// Extração Local de Fatos (sem LLM)
// ─────────────────────────────────────────────────────────────
const PADROES_FATOS = [
    {
        regex: /(?:me chamo|meu nome é|pode me chamar de|me chama de|me chame de)\s+([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)*)/i,
        template: (m) => `Usuário prefere ser chamado de ${m[1]}`,
    },
    {
        regex: /(?:sou|trabalho como|minha profissão é|minha profissao é)\s+([a-zà-ú ]+?)(?:\s*[,.]|$)/i,
        template: (m) => `Usuário é ${m[1]?.trim()}`,
    },
    {
        regex: /tenho\s+(\d+)\s+anos/i,
        template: (m) => `Usuário tem ${m[1]} anos`,
    },
    {
        regex: /(?:moro|vivo|sou de|sou do|sou da)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
        template: (m) => `Usuário mora em ${m[1]}`,
    },
    {
        regex: /(?:tenho|tenho um|tenho uma)\s+(?:filho|filha|bebê|bebe)\s+(?:de\s+)?(\d+\s+(?:ano|mes|mês)s?)?/i,
        template: (m) => `Usuário tem um(a) filho(a)${m[1] ? ` de ${m[1]}` : ""}`,
    },
    {
        regex: /(?:gosto muito de|adoro|amo)\s+([a-zà-ú ]+?)(?:\s*[,.]|$)/i,
        template: (m) => `Usuário gosta muito de ${m[1]?.trim()}`,
    },
    {
        regex: /(?:não gosto de|detesto|odeio)\s+([a-zà-ú ]+?)(?:\s*[,.]|$)/i,
        template: (m) => `Usuário não gosta de ${m[1]?.trim()}`,
    },
];
/** Extrai fatos simples de um texto usando regras locais (sem LLM). */
export function extrairFatosLocalmente(texto) {
    const fatosEncontrados = [];
    for (const { regex, template } of PADROES_FATOS) {
        const match = texto.match(regex);
        if (match) {
            const fato = template(match);
            if (fato && fato.length > 5 && fato.length < 200) {
                fatosEncontrados.push(fato);
            }
        }
    }
    return fatosEncontrados;
}
const PADROES_TOPICOS = [
    { regex: /\b(next\.?js|nextjs)\b/i, topico: "Next.js" },
    { regex: /\b(react)\b/i, topico: "React" },
    { regex: /\b(typescript|ts)\b/i, topico: "TypeScript" },
    { regex: /\b(python)\b/i, topico: "Python" },
    { regex: /\b(node\.?js|nodejs)\b/i, topico: "Node.js" },
    { regex: /\b(clima|tempo|chuva|sol)\b/i, topico: "Clima" },
    { regex: /\b(musica|música|youtube|spotify)\b/i, topico: "Música" },
    { regex: /\b(notícias|noticias|novidades)\b/i, topico: "Notícias" },
    { regex: /\b(receita|cozinha|comida)\b/i, topico: "Culinária" },
    { regex: /\b(arquivo|pasta|documento)\b/i, topico: "Arquivos" },
    { regex: /\b(financiamento|banco|dinheiro|finanças)\b/i, topico: "Finanças" },
];
/** Extrai tópicos mencionados numa conversa (sem LLM). */
export function extrairTopicosLocalmente(texto) {
    const topicos = [];
    for (const { regex, topico } of PADROES_TOPICOS) {
        if (regex.test(texto) && !topicos.includes(topico)) {
            topicos.push(topico);
        }
    }
    return topicos;
}
// ─────────────────────────────────────────────────────────────
// Inicialização do Cofre
// ─────────────────────────────────────────────────────────────
/** Garante que as pastas principais do Nero-brain existem. */
export function inicializarCofre() {
    const pastas = [
        NERO_BRAIN_DIR,
        OB_PERFIL_DIR,
        OB_CONVERSAS_DIR,
        OB_CONHECIMENTO_DIR,
        OB_APRENDIZADO_DIR,
    ];
    for (const pasta of pastas) {
        garantirDir(pasta);
    }
    // Cria arquivo de índice se não existir
    const indice = path.join(NERO_BRAIN_DIR, "Índice.md");
    if (!fs.existsSync(indice)) {
        const conteudo = `# Cérebro do Nero

Bem-vindo ao cofre de conhecimento do Nero!

## Estrutura

- [[Perfil/Usuário]] — Fatos aprendidos sobre o usuário
- [[Conversas/]] — Histórico de sessões de chat
- [[Base de Conhecimento/]] — Tópicos pesquisados
- [[Aprendizado/]] — Notas de aprendizado contínuo

---
*Criado automaticamente pelo Nero em ${timestampPtBR()}*
`;
        try {
            fs.writeFileSync(indice, conteudo, "utf-8");
            console.log("📚 [Obsidian] Índice do Nero-brain criado.");
        }
        catch (e) {
            console.warn("⚠️ [Obsidian] Erro ao criar índice:", e);
        }
    }
    console.log(`🧠 [Obsidian] Cofre Nero-brain inicializado em: ${NERO_BRAIN_DIR}`);
}
// ─────────────────────────────────────────────────────────────
// Auto-RAG (Retrieval-Augmented Generation) Silencioso
// ─────────────────────────────────────────────────────────────
/** Remove acentos e caracteres especiais para extrair palavras-chave */
function extrairPalavrasChave(texto) {
    const ignorar = new Set(["quero", "queria", "gostaria", "poderia", "fazer", "saber", "sobre", "qual", "quais", "quem", "como", "onde", "quando", "agora", "hoje", "ontem"]);
    const limpo = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const palavras = limpo.match(/\b[a-z]{4,}\b/g) || [];
    return Array.from(new Set(palavras.filter(p => !ignorar.has(p))));
}
/** Lê o final do último arquivo de conversas e gera o contexto auto-injetado baseado na query do usuário. */
export function recuperarContextoAutomatico(mensagemUsuario) {
    let contexto = "";
    // 1. Resgate da Memória da Última Sessão
    try {
        const conversas = fs.readdirSync(OB_CONVERSAS_DIR).filter(f => f.endsWith(".md")).sort();
        if (conversas.length > 0) {
            const ultima = conversas[conversas.length - 1];
            const filepath = path.join(OB_CONVERSAS_DIR, ultima);
            const conteudo = fs.readFileSync(filepath, "utf-8");
            // Pegar as últimas linhas da sessão (cerca de 600 caracteres)
            const fim = conteudo.slice(-600).trim();
            contexto += `[MEMÓRIA PASSADA - RESUMO DAS ÚLTIMAS CONVERSAS DO ARQUIVO MORTO (${ultima})]\n${fim}\n\n`;
        }
    }
    catch (e) {
        /* ignora se a pasta não existir ou estiver vazia */
    }
    // 2. Resgate de Base de Conhecimento e Aprendizado (RAG via palavras-chave)
    try {
        const palavrasChave = extrairPalavrasChave(mensagemUsuario);
        if (palavrasChave.length > 0) {
            const pastasBusca = [OB_CONHECIMENTO_DIR, OB_APRENDIZADO_DIR];
            const trechosRAG = [];
            for (const pasta of pastasBusca) {
                if (!fs.existsSync(pasta))
                    continue;
                const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith(".md"));
                for (const arq of arquivos) {
                    const caminho = path.join(pasta, arq);
                    const conteudo = fs.readFileSync(caminho, "utf-8");
                    const conteudoLower = conteudo.toLowerCase();
                    const tituloLower = arq.toLowerCase();
                    // Se alguma palavra-chave bate com o título da nota, tem alta relevância
                    const matchTitulo = palavrasChave.some(p => tituloLower.includes(p));
                    // Se não, vê se bate no conteúdo
                    const matchConteudo = !matchTitulo && palavrasChave.some(p => conteudoLower.includes(p));
                    if (matchTitulo || matchConteudo) {
                        // Pega o primeiro parágrafo útil da nota
                        const paragrafos = conteudo.split("\n\n").filter(p => p.trim().length > 20 && !p.startsWith("---") && !p.includes("tipo: "));
                        if (paragrafos.length > 0) {
                            trechosRAG.push(`Nota "${arq.replace(".md", "")}": ${paragrafos[0]?.slice(0, 300)}...`);
                            if (trechosRAG.length >= 3)
                                break; // Limita a 3 notas injetadas para não estourar tokens
                        }
                    }
                }
            }
            if (trechosRAG.length > 0) {
                contexto += `[DADOS RECUPERADOS DA SUA BASE DE CONHECIMENTO NO OBSIDIAN RELACIONADOS À MENSAGEM ATUAL]\n`;
                contexto += trechosRAG.map(t => `- ${t}`).join("\n") + "\n\n";
            }
        }
    }
    catch (e) {
        /* ignora */
    }
    return contexto;
}

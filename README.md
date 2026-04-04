# 🤖 Nero Agent (TypeScript) — Assistente Pessoal de IA por Voz

Assistente pessoal de IA ativado por voz, com **inteligência autônoma** via Groq (Llama 3.1 8B), **memória de longo prazo** e **ferramentas** que ele decide sozinho quando usar. Construído com TypeScript, React (Vite) e Node.js (Express).

> Fala Português do Brasil 🇧🇷 · Voz neural Edge TTS · Roda no Windows.

---

## ✨ Funcionalidades

### 🧠 Inteligência
- **LLM Dual**: Alterne facilmente entre um LLM rodando localmente (via LM Studio, Ollama, etc.) e a API de alta velocidade da Groq na nuvem.
- **Function Calling**: O LLM analisa o que você diz e decide de forma autônoma se precisa usar uma ferramenta (como pesquisar na web) ou apenas conversar.
- **Memória de Longo Prazo**: Aprende fatos sobre você (nome, preferências, hábitos) e os armazena em `perfil_nero.json` para lembrar entre sessões.
- **Memória de Curto Prazo**: Mantém o histórico das últimas conversas em `memoria_nero.json` para dar contexto ao diálogo.
- **Aprendizado Contínuo**: Após cada interação, um LLM em segundo plano analisa a conversa para extrair e salvar novos fatos sobre você.

### 🎤 Voz
- **Conversa por Voz**: Use a voz para interagir com o Nero, com reconhecimento de fala diretamente no navegador (Chrome/Edge).
- **Wake Word**: Diga "Nero" para ativar o assistente quando ele estiver em modo de espera.
- **TTS Neural via Servidor**: As respostas são convertidas em áudio com uma voz natural (`pt-BR-AntonioNeural`) através do backend, garantindo consistência.
- **Interrupção por Voz**: Você pode falar a qualquer momento para interromper a resposta do Nero.

### 🛠️ Ferramentas Autônomas

O Nero decide sozinho quando usar cada ferramenta:

| Ferramenta | Comando exemplo |
|------------|----------------|
| 🎵 Tocar no YouTube | *"toca o último álbum do The Killers no YouTube"* |
| ⏯️ Controlar Mídia | *"pausa a música"* / *"próxima faixa"* / *"volta uma música"* |
| 🔊 Alterar Volume | *"aumenta o volume para 80%"* / *"mutar"* |
| 💻 Abrir Programa | *"abre a calculadora"* / *"inicia o VS Code"* |
| ❌ Fechar Programa | *"fecha o bloco de notas"* |
| 📰 Notícias do Dia | *"quais são as notícias de hoje?"* |
| 🗓️ Data e Hora | *"que horas são?"* / *"que dia é hoje?"* |
| 🌤️ Clima | *"como está o clima em São Paulo?"* |
| 🔍 Pesquisa Web | *"pesquisa sobre a história da computação"* |
| 🌐 Abrir Navegador | *"abre o GitHub"* |
| 📸 Capturar Tela | *"tira um print da tela toda"* |
| 📝 Criar Anotação | *"anota aí: comprar pão e leite amanhã"* |

### 🗣️ Comandos de Controle por Voz

| Comando | Ação |
|---------|------|
| *"Nero"* | Ativa o assistente (wake word) |
| *"vai descansar"* | Coloca o Nero em modo de espera (stand-by) |
| *"o que você sabe sobre mim?"* | Lista fatos aprendidos |
| *"limpa a memória"* / *"esquece tudo"* | Apaga as memórias de curto e longo prazo |

---

## 📁 Estrutura do Projeto

```
Eon-Agent/
├── agente_local.py     ← Loop principal + Groq function calling
├── ferramentas.py      ← 9 ferramentas + schemas para o LLM
├── memoria.py          ← Memória de curto prazo + longo prazo + aprendizado
├── audio.py            ← Microfone global, TTS Edge, wake word, interrupção
├── config_eon.json     ← Configuração do nome do usuário
├── memoria_nero.json   ← Memória de curto prazo (auto-gerado)
├── perfil_nero.json    ← Memória de longo prazo — fatos aprendidos (auto-gerado)
└── README.md
```

---

## ⚙️ Instalação

### Pré-requisitos
- Python 3.10+
- Windows 10/11
- Microfone

### Dependências

```bash
python -m pip install groq SpeechRecognition edge-tts pygame pywhatkit pyautogui Pillow requests duckduckgo-search
```

---

## 🚀 Como Usar

```bash
cd C:\Eon-Agent
python agente_local.py
```

1. O Nero inicia e fica em **stand-by** 💤
2. Diga **"Nero"** para ativar
3. Converse ou peça ações naturalmente
4. Diga **"vai descansar"** para voltar ao stand-by
5. Diga **"desligar sistema"** para encerrar

---

## 🔑 Configuração

### Arquivo .env
O projeto utiliza um arquivo `.env` para gerenciar chaves de API e configurações sensíveis.
1. Copie o arquivo `.env.example` para `.env`.
2. Insira sua `GROQ_API_KEY` no arquivo `.env`.

> [!CAUTION]
> Nunca envie seu arquivo `.env` para o GitHub. Ele já está configurado no `.gitignore`.

### Configurações Adicionais
- **Groq**: Pegue sua chave em [console.groq.com](https://console.groq.com).
- **Nome do Usuário**: Edite `config_eon.json`.

---

## 🧠 Como Funciona a Inteligência

### Function Calling (Intenções)
```
Usuário: "toca Metallica no YouTube"
  ↓
Groq analisa → detecta intenção → chama tocar_youtube("Metallica")
  ↓
Função executa → retorna resultado
  ↓
Groq formula resposta: "Colocando Metallica no YouTube!"
```

### Aprendizado de Longo Prazo
```
Conversa: "me chame de Mestre"
  ↓
Groq responde normalmente
  ↓
2ª chamada (background): analisa e extrai → "O usuário quer ser chamado de Mestre"
  ↓
Salva em perfil_nero.json → próxima sessão já lembra
```

---

## 🛣️ Roadmap

- [x] Groq como cérebro (substituiu Google AI)
- [x] Wake word + TTS + interrupção por voz
- [x] Memória de curto prazo persistente
- [x] Memória de longo prazo com aprendizado via LLM
- [x] Function calling — 9 ferramentas autônomas
- [ ] Controle de abas do Chrome por nome
- [ ] Modo programação (IDE automation)
- [ ] Visão computacional (OCR/Tesseract)
- [ ] Rotinas automáticas baseadas em padrões do usuário

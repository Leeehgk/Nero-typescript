# Nero Agent (TypeScript)

Assistente pessoal com voz, memoria, automacao local no Windows e avatar 3D em React Three Fiber.

O projeto roda com:

- frontend React + Vite
- backend Express + TypeScript
- LLM local compativel com OpenAI (ex.: LM Studio)
- Groq como opcao de nuvem
- TTS neural via Edge no servidor
- reconhecimento de voz via Web Speech API no navegador

## Estado atual

O README abaixo ja reflete o comportamento atual do projeto, incluindo as implementacoes massivas recentes:

- **Sistema Modular de Moveis**: Lote 1 introduzido com 12 tipos de mobília de luxo e plantas, mecanica de arrastar e soltar (Drag and Drop) no grid 3D, salvar no `localStorage` e rotacionar itens livremente.
- **Paredes Magneticas**: Quadros e itens de parede detectam os contornos da sala automaticamente e "grudam" elevados na angulacao certa.
- **Painel de Estilos (Multiverso)**: O mundo do Nero agora aceita temas globais dinâmicos (Chao, paredes e ceu) e Skins para o Avatar, tudo configurado em tempo real pelo painel `StylePanel`.
- **Cosmetico do Avatar**: Adicionada a skin de mascara Hacker (Guy Fawkes) usando geracao procedural de geometria no `PixelAgent` que acompanha o agente enquanto movimenta a cabeca.
- **Voice Interruption Inteligente**: O TTS foi calibrado para usar palavras-chave imperativas como freio (`"pare"`, `"shh"`...), impedindo que as caixas de som entrem num loop infinito causando a gagueira por corte precoce em respostas longas.
- TTS do servidor mais estavel, com fallback automatico de voz em portugues quando `pt-BR-AntonioNeural` falha.
- Recuperacao de tool calls no formato `<function=...>` quando o provedor retorna `tool_use_failed`.
- Bloqueio de ferramentas sensiveis quando o pedido do usuario nao for explicito.
- PixelAgent com locomocao aleatoria funcional, ida ao PC durante interacoes e pausa controlada apos responder.

## Principais recursos

### Personalizacao e Ambiente 3D
- **Temas Dinamicos da Sala**: Alterne entre a vibracao original ("Common"), a tematica escura cybernetica iluminada por neons emissivos ("Dark Hacker"), ou o modo luxuoso ("Suite Premium").
- **Loja de Moveis**: Arraste, drope e gire itens como sofas, TVs, quadros e plantas no grid de `(-5, 5)` com os dados salvos nativamente.
- **Skins de Agente**: Visual expansivel em camadas, atualmente introduzindo mascara de Hacker "Anonymous" presa ao guimbal de visao 3D do agente.

### Voz

- Conversa por voz em portugues do Brasil.
- Wake word com variacoes de "Nero" ou interrupcao brusca (ex. "Pare", "Silencio") para matar longas respostas de TTS.
- TTS neural servido por `POST /api/tts`.
- Fallback para TTS do navegador se o audio do servidor falhar.

### Memoria e LLM
- Alternancia entre provedor local e Groq pela interface.
- Respostas curtas por padrao para manter a conversa rapida.
- Memoria curta persistida em `memoria_nero.json` e `perfil_nero.json`.
- Consulta e construcao iterativa dos fatos em segundo plano pelo proprio Nero.

### Memoria

- Memoria curta persistida em `memoria_nero.json`.
- Perfil persistido em `perfil_nero.json`.
- Limpeza rapida por comando de voz ou texto.
- Consulta dos fatos aprendidos pelo proprio Nero.

### Ferramentas

Ferramentas disponiveis hoje:

- tocar musica no YouTube
- controlar midia
- alterar volume
- obter data e hora
- obter clima
- ler noticias do dia
- pesquisar na web
- abrir navegador
- abrir programa
- fechar programa
- capturar tela
- criar anotacao
- obter musica atual
- esconder, restaurar e alternar janelas

Seguranca atual:

- ferramentas com risco de abrir programas, mexer em janela, volume ou navegador so executam com pedido claro
- conversa ambigua nao vira automacao no Windows
- o agente nao deve dizer que executou algo sem chamar a ferramenta correspondente

## Requisitos

- Windows 10 ou 11 para as automacoes locais
- Node.js 20+ recomendado
- npm
- Chrome ou Edge para reconhecimento de voz
- microfone liberado no navegador
- LM Studio ou outro endpoint OpenAI-compatible, se for usar modelo local

## Instalacao

```bash
npm install
```

## Configuracao do ambiente

Crie o arquivo `.env` a partir de `.env.example`.

```bash
copy .env.example .env
```

Variaveis suportadas hoje:

| Variavel | Obrigatoria | Padrao | Uso |
| --- | --- | --- | --- |
| `LOCAL_LM_URL` | nao | `http://127.0.0.1:1234/v1` | Base URL do modelo local compativel com OpenAI |
| `LOCAL_LM_MODEL` | nao | `local-model` | Nome padrao do modelo local |
| `OPENAI_API_KEY` | nao | `lm-studio` | Chave usada no cliente OpenAI do provedor local |
| `GROQ_API_KEY` | so para Groq | vazio | Chave da API Groq |
| `GROQ_MODEL` | nao | `llama-3.1-8b-instant` | Modelo padrao do Groq |
| `EDGE_TTS_VOICE` | nao | `pt-BR-AntonioNeural` | Voz preferida do TTS do servidor |
| `PORT` | nao | `8787` | Porta da API Express |
| `NERO_MAX_REPLY_TOKENS` | nao | `640` | Limite de tokens da resposta |
| `NERO_CONTEXT_MESSAGES` | nao | `12` | Quantas mensagens entram no contexto enxuto do LLM |
| `NERO_MAX_FACTS_SYSTEM` | nao | `12` | Quantos fatos do perfil entram no prompt |
| `NERO_MAX_CHARS_PER_MSG` | nao | `1200` | Truncagem por mensagem no contexto |

Exemplo de `.env`:

```env
LOCAL_LM_URL=http://127.0.0.1:1234/v1
LOCAL_LM_MODEL=nome-do-modelo-no-lm-studio
OPENAI_API_KEY=lm-studio

GROQ_API_KEY=sua_chave_groq_aqui
GROQ_MODEL=llama-3.1-8b-instant

EDGE_TTS_VOICE=pt-BR-AntonioNeural
PORT=8787

NERO_MAX_REPLY_TOKENS=640
NERO_CONTEXT_MESSAGES=12
NERO_MAX_FACTS_SYSTEM=12
NERO_MAX_CHARS_PER_MSG=1200
```

### Nome do usuario

O nome usado pelo Nero pode ser configurado em `config_eon.json` na raiz:

```json
{
  "nome_usuario": "chefe"
}
```

Se o arquivo nao existir, o backend usa `"chefe"` por padrao.

## Como rodar

### Desenvolvimento completo

```bash
npm run dev
```

Isso sobe:

- cliente Vite
- servidor Express em modo watch

### Somente servidor

```bash
npm run dev:server
```

### Somente cliente

```bash
npm run dev:client
```

### Verificacao de tipos

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

### Preview do frontend buildado

```bash
npm run preview
```

## Fluxo da aplicacao

### Cliente

- `src/App.tsx`: layout principal, estado visual, botoes de Loja e Estilo e painel de debug
- `src/components/OfficeScene.tsx`: cenario 3D isometrico responsivo por `ThemeMode`
- `src/components/PixelAgent.tsx`: avatar, guimbal geometrico de skins (`SkinMode`), movimento e reacoes
- `src/components/FurnitureRegistry.tsx`: catalogo mestre de modelos e comportamento magico das paredes (.tsx)
- `src/components/StylePanel.tsx`: UI lateral flutuante de Customizacao dos componentes visuais  
- `src/voice/useNeroVoiceConversation.ts`: ciclo de standby, regexes de interrupção rigorosas, TTS callback e rearme do microfone
- `src/voice/tts.ts`: abort controller e audio handling client-side com Fallbacks

### Servidor

- `server/index.ts`: API Express e rotas principais
- `server/agent.ts`: orchestracao do LLM e intencoes isoladas de ferramenta
- `server/tools.ts`: automacoes de Windows (Browser, apps, shell, audio, files)
- `server/tts-edge.ts`: sintese de bytes e stream pro front-end

## API

Rotas expostas hoje:

- `GET /api/health`: status basico da API e dos provedores
- `GET /api/config`: configuracao atual exposta ao cliente
- `GET /api/state`: quantidade de mensagens, fatos e nome do usuario
- `POST /api/chat`: conversa com o agente
- `POST /api/tts`: sintetiza audio MP3 da resposta

## Conversa por voz

Requisitos:

- Chrome ou Edge
- `localhost` ou contexto seguro `https`
- permissao de microfone liberada

Comportamento atual:

- ao clicar em "Ativar conversa por voz", o Nero entra em standby
- ao ouvir variantes de "Nero", entra em escuta ativa
- durante a escuta ativa, o microfone continua se rearmando automaticamente
- enquanto o Nero pensa ou fala, a escuta e pausada
- quando a resposta termina, a escuta volta sozinha
- o usuario pode interromper a fala do Nero voltando a falar

## PixelAgent

O comportamento atual do avatar esta centralizado em `src/components/PixelAgent.tsx`.

### Mapa

- grade de movimento de `-5` a `5` nos eixos `x` e `z`
- clique no chao move o destino externo
- teclado `WASD` e setas tambem pode deslocar por azulejo

### Estados do avatar

- `idle`: vagueia livremente pelo mapa
- `listening`: continua se movendo, sem travar a conversa
- `thinking`: vai ate a estacao de trabalho `[3, -2]` e gira para o alvo da tela do PC
- `speaking`: fica na area do PC durante a interacao
- `success`: mantem comportamento de interacao encerrando a acao
- `error`: mantem comportamento de interacao para feedback visual

### Regras de movimento atuais

- velocidade de caminhada definida por `WALK_SPEED = 4.9`
- rotacao suavizada por `ROTATION_SPEED = 9`
- o destino aleatorio e escolhido a partir da posicao atual
- durante interacao, o alvo interno muda para a estacao de trabalho
- quando a interacao termina, o Nero fica parado por 10 segundos na mesa
- depois da pausa, volta a patrulhar sozinho

### Coordenadas importantes

- ponto de trabalho: `[3, -2]`
- alvo visual da tela do PC: `[3, -4]`

### Debug de movimento

A interface mostra um painel de debug com:

- `mood global`
- `alvo store`
- `pos avatar`
- `alvo interno`
- `andando`
- `mood avatar`
- `atualizacao`

Esse painel tem sido usado para depurar render loop, alvo interno e locomocao do avatar.

## Monitor e cena 3D

Comportamento atual da mesa do computador:

- quando o Nero entra em acao, a tela do monitor fica branca por 10 segundos
- a tela acende sem lancar luz real na sala
- o brilho fica restrito ao plano do monitor

A cena tambem recebeu ajustes de estabilidade:

- `Canvas` com `frameloop="always"` para evitar congelamento do avatar
- baloes de fala renderizados fora do `Canvas`
- `error boundary` na interface principal
- remocao de efeitos que estavam lavando cantos do mapa

## Memoria e arquivos gerados

Arquivos persistidos na raiz do projeto:

- `memoria_nero.json`: memoria curta com ate 30 mensagens
- `perfil_nero.json`: fatos aprendidos sobre o usuario, com limite de 50
- `anotacoes_nero.txt`: anotacoes criadas pela ferramenta
- `Prints/`: capturas de tela feitas pelo agente
- `config_eon.json`: configuracao do nome do usuario

## Estrutura resumida

```text
Nero-typescript/
|- src/
|  |- components/
|  |  |- OfficeScene.tsx
|  |  |- PixelAgent.tsx
|  |  `- HabboKeyboard.tsx
|  |- voice/
|  |  |- useNeroVoiceConversation.ts
|  |  |- speechRecognition.ts
|  |  `- tts.ts
|  |- App.tsx
|  `- store.ts
|- server/
|  |- index.ts
|  |- agent.ts
|  |- llm.ts
|  |- memory.ts
|  |- tools.ts
|  |- tts-edge.ts
|  `- paths.ts
|- .env.example
|- memoria_nero.json
|- perfil_nero.json
`- README.md
```

## Solucao de problemas

### O microfone fecha sozinho

- use Chrome ou Edge
- confira permissao de microfone
- rode em `localhost` ou `https`
- confirme que o modo de voz esta ativo

### O Nero nao fala com a voz Antonio

- confira `EDGE_TTS_VOICE` no `.env`
- teste `POST /api/tts`
- o servidor tenta fallbacks em portugues se a voz principal falhar

### Groq nao responde

- confirme `GROQ_API_KEY`
- confira o modelo em `GROQ_MODEL`
- a UI mostra quando o Groq nao esta configurado

### O agente abre coisas sem pedir

O backend hoje bloqueia ferramentas sensiveis sem intencao explicita. Se isso voltar a acontecer, revise `server/agent.ts`, especialmente:

- `RISKY_TOOLS`
- `hasExplicitActionIntent`
- `isToolAllowed`

## Observacoes

- varias automacoes dependem de Windows
- busca web, noticias e clima dependem de acesso a internet
- o TTS do servidor usa `edge-tts-universal`
- o provedor local usa cliente OpenAI apontando para um endpoint compativel

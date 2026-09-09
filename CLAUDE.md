# CLAUDE.md — The Inclusionist

Contexto de projeto carregado automaticamente pelo Claude Code. **Enxuto de propósito**: aqui ficam as regras
de entrada e os ponteiros; a verdade detalhada vive no **código tipado** (`app/js/**`) e em `docs/**`.

- **Idioma dos ARTEFATOS (projeto open-source):** **inglês** — docs, comentários de código, strings de UI e
  **mensagens de commit**. **Exceção pt-BR:** conteúdo de domínio intrinsecamente brasileiro (objetivos BNCC, pedagogia
  de alfabetização, *features* Gherkin das atividades, que são lidas por educadores). **A conversa com o Dev é em
  pt-BR.** Este arquivo (manual operacional da IA) segue em pt-BR de propósito.
- **Idiomas do JOGO — piso de três:** **pt-BR** (base), **inglês** e **espanhol**. Não é meta, é mínimo; toda string de
  UI nasce localizável (`t()`/`data-i18n`), nunca fixa no código. Ver o pilar 3 do ADR-0010, `1-Discovery/plano-i18n.md`
  e a **Fase 5** no quadro.
- **A FRONTEIRA (decidida pelo Dev em 2026-08-24, e mais estreita do que parecia):** o idioma do programa é o idioma
  da **interface**, e é ele que define a língua "oficial" do jogador — a língua de origem de todas as atividades.
  **O ENUNCIADO SEMPRE TRADUZ.** Numa atividade de ciências, trocar o idioma traduz o enunciado; numa atividade de
  **disciplina de idioma** vale o mesmo, com uma única exceção: **o CONTEÚDO linguístico não é traduzido**, porque ele
  *é* a matéria. A palavra a montar, a letra, a sílaba, a soletração e a cela Braille seguem em pt-BR; o "Escreva a
  palavra:" que os envolve traduz. Na prática vira uma regra mecânica: **a moldura mora na chave, o conteúdo atravessa
  por `{param}`**.
  ⚠️ **Matemática NÃO é disciplina de idioma.** `2 + 3` independe de língua, então "Quanto é 2 mais 3?" é enunciado e
  traduz inteiro — inclusive os operadores por extenso ("mais"/"vezes"/"dividido por") e os números falados.

## 0. Regra de ouro (operacional — o que mais me guia)

- **Eu faço os commits** (atômicos, **em inglês**, na `main`, com trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`).
  **O Dev roda** o push/deploy e tudo que **GASTA** (cota, dinheiro, ação irreversível).
  ⚠️ **EU RODO NODE** — medido em 2026-09-04: `node v24.14.0`, `npm 11.9.0`. A linha anterior dizia que o Dev
  rodava TODO comando Node porque eu não tinha nenhum, e isso deixou de ser verdade: eu rodo `npm run build`,
  `npx vitest run` e `npx tsc --noEmit` e **provo o gate vermelho antes de valer**, em vez de deixar a prova
  para ele. Instrução obsoleta não é inofensiva: esta transferia para o Dev trabalho que é meu.
- **Loop de trabalho:** eu extraio/edito → **eu valido** (build + vitest + tsc) → **eu confiro o boot no preview**
  (canvas ≥ 1 + `window.__incl`; nunca só screenshot do título). O Dev revê o resultado, não o executa.
- **Preview: usar o server `dist`** (`npm run preview` sobre `dist/`, **depois do `npm run build`**) — o
  server **`inclusionist`/dev (`npm run dev`, Vite) NÃO roda no sandbox** (o pré-bundle de deps do Vite não fica
  pronto → grafo de módulos morto → tela quebrada). O `launch.json` é **local, não-versionado** — nunca sobrescrever
  sem ler antes.
- **Sinalize antes de executar** incoerências/erros. **Anuncie decisões não triviais:** `Decisão: X porque Y. Para
  sobrepor, diga Z.` **"ok/tudo ok" ≠ carta branca** → proponho e confirmo a próxima escolha, não sigo sozinho.
- **Decisão confirmada ganha lar durável NO MESMO TURNO** — não deixar como prosa no chat. Se for arquitetural →
  um **ADR (YADR)** em `docs/2-Architecture/adr/` + entrada no índice; senão → o doc canônico certo; e **reflita no
  mapa** (`ARCHITECTURE.md`) quando muda onde algo vive. Concordar/discordar sem registrar = decisão perdida.
- **REGISTRAR É EXECUÇÃO, NÃO CONSULTA** (2026-08-27, depois de o Dev medir o estrago). Quando a decisão dele
  **revoga** um ADR aceito, o registro sai no MESMO turno, escrito, e ele desfaz se discordar — não se pergunta
  "quer que eu registre?".
  ⚠️ **E o MECANISMO mudou em 2026-09-04 (ADR-0057): revogação vira REGISTRO NOVO que supersede, nunca emenda
  no lugar.** A velocidade estava certa e fica; a emenda é que estava errada. A frase antiga dizia "a emenda sai
  no mesmo turno" e foi ela que institucionalizou o defeito — cinco registros aceitos foram editados no lugar em
  28/08, e um diagnóstico externo leu `status: accepted` num deles cuja premissa já tinha morrido. Emenda no
  lugar só para **errata**: quando o registro NUNCA disse o que foi decidido (citação errada, número trocado).
  O teste: *o autor original, com os mesmos fatos daquele dia, teria escrito a mesma frase?* Sim → supersede. O motivo é mecânico e não de zelo: um ADR que segue afirmando a posição antiga **volta a
  argumentar contra ele** na conversa seguinte, comigo ou com quem ler. Medido: sete escolhas dele entraram no
  código e não no registro, e o ADR-0011 chegou a guardar a justificativa contrária com as aspas dele.
  **Mesma regra para issue resolvida: eu fecho.** ("Se eu já tomei a decisão e já está resolvido, você fecha
  sim!") A linha que separa: **pergunto antes de GASTAR** (cota, dinheiro, ação irreversível, disparo de LLM);
  **não pergunto para REGISTRAR** o que ele já decidiu. E quando ele propõe direção, a resposta abre pelo que dá
  para fazer — objeção continua valendo, mas depois do caminho, não no lugar dele.
- **Doc alterada VIRA teste, tarefa (issue) ou ADR** — com pouquíssimas exceções, documentação que não se transforma
  em algo acionável (um teste que a verifica, uma issue de trabalho, ou um ADR que a decide) **não serve**. Ao mexer
  num doc, pergunte "isto vira o quê?" e crie.
- **O TO-DO / BACKLOG do projeto vive nas Issues do GitHub** (`the-inclusionist/the-inclusionist-engine`),
  **NÃO em docs**. Trabalho novo → uma **issue** (labels: área + tipo + prioridade P0/P1/P2); o commit fecha com
  `Closes #N`. `ROADMAP.md` guarda só a estratégia/ordem. (Mexo no quadro por `gh`.)
  ⚠️ **Migrado em 2026-09-06, e os NÚMEROS sobreviveram**: as 101 issues foram recriadas em ordem crescente
  num repositório de contador zerado, então `#1`–`#101` continuam apontando para a mesma coisa. Todo `#N`
  escrito antes desta data segue válido. O GitLab está arquivado.
- **`ARCHITECTURE.md` é O MAPA** — o 1º doc a consultar em QUALQUER prompt (meu e das LLMs que eu coordeno) para achar
  o que ler/alterar. **Toda** mudança de estrutura/nome/convenção de doc **reflete nele no mesmo turno**.
- **Ensinar-e-deixar-ele-rodar:** para mudanças de estado (git push, npm, sistema), oriento e preparo os arquivos;
  **quem roda é o Dev**, no PowerShell.

## 1. Visão

⚠️ **CORRIGIDO 2026-09-05 — "EdSP" NÃO EXISTE.** Esta seção abria com "EdSP = engine + uma coleção", como se
houvesse duas coisas e a segunda fosse o guarda-chuva da primeira. Não há. Por decisão do Dev: **existe *The
Inclusionist*, e só.** O nome antigo sobrevive em ADRs e em comentários de código porque era o nome usado à
data — um ADR é registro histórico e não se reescreve —, mas **não nomeia nada** e não entra em texto novo.
Onde o código disser "a EdSP entrega o catálogo", leia "a plataforma": é *The Inclusionist* a cumprir o papel.

***The Inclusionist*** = engine de **jogos educativos** + uma **coleção** de jogos para **gamificar toda a
educação básica brasileira** (infantil · fundamental · médio) e, por proximidade, **EJA** e
**profissionalizante/capacitação** (letramento digital para cidadania e mercado de trabalho), além de
**passatempos de convivência** (centros de convivência de idosos e pessoas assistidas socialmente).
Plataforma 2D pixel-art **acessível** (PixiJS). Reimplementação clean-room do engine Clarity. ⚠️ **O plano dos "35+ jogos" morreu em
2026-08-28**, por decisão do Dev: o MVP são os **300+ jogos** do `minigames-catalog-v2.html`. ⚠️ **Não há contratação:
o trabalho só existe por VOLUNTARIADO (ADR-0070)** — a linha anterior dizia "pixel artistas contratados" e
descrevia um orçamento que não existe. Consequência que muda o dia a dia: **descoberta é insumo de produção**,
e os 300 jogos **não têm cronograma**. Topologia: **ADR-0058** (que supersede o ADR-0055).
⚠️ **Cada jogo é um REPOSITÓRIO seu (ADR-0068)**, e o `the-inclusionist-demos` deixou de guardá-los: ele passou
a guardar o **manifesto** que diz quais jogos e quais versões entram numa entrega — porque o orçamento de
precache nunca deixaria o catálogo inteiro chegar ao aparelho de escola. Repositório se cria quando um
registro declara o endereço, com README que diz que está vazio (**ADR-0067**), e tudo vive numa organização
do GitHub, privada até o ato (**ADR-0066**).

- **🔴 PILARES INEGOCIÁVEIS** (constituição — leia ANTES de agir): `docs/2-Architecture/adr/ADR-0010-non-negotiable-pillars.yaml`. 10 pilares:
  hardware de escola pública BR (Positivo/Chromebook) · a11y (WCAG 2.2 + GAG; Libras em motor zdog à parte) · i18n ·
  conformidade LGPD/COPPA/China/Nórdicos (**a lei local da região de implantação vence**; a "regra mais rígida
  vence" foi aposentada pelo ADR-0010 por ser autocontraditória — ela faria a norma chinesa valer no Brasil) · pixel 320×180 (Libras 420×180) · telemetria
  1EdTech+xAPI com privacidade infantil rígida · multiplayer em telas separadas (sem split-screen) · **offline: PWA no primeiro dia ONLINE, depois OFFLINE-FIRST** ·
  LAN + telemetria store-and-forward · **AGPL-3.0** (código; era GPL-3.0 até 2026-08-25 — ver o pilar 10 do
  ADR-0010) + **arte não-FOSS** + gratuito + fomento.
- **Arte = dados:** nenhum PNG embutido no jogo. O alvo é **arte procedural semântica** (imagem semântica
  `(região, luminosidade)` + dicionário de paletas → recolor infinito, unificado personagens+tiles). PNG/Aseprite/
  Tiled só na **autoria**. Plano: `docs/plano-arte-procedural.md`, importadores em `docs/plano-tiled-aseprite.md`.
- **a11y-first:** quando estética briga com a11y, a11y vence. AAA é aspiracional — **marque honestamente** onde só
  dá AA (ex.: 1.4.6 7:1 briga com cores vivas). Nunca vender "AAA em bloco".

## 2. Estrutura & toolchain

- Repo `SP-the-inclusionist-tracer/` (git). O jogo publicável vive em **`app/`**; o código em **`app/js/**`** (ES
  Modules `.ts`). ⚠️ **NÃO HÁ DEPLOY LIGADO** (informado pelo Dev em 2026-09-07): **nenhum projeto do
  Cloudflare Pages está conectado a repositório nenhum** neste momento. Esta linha dizia «Deploy = `dist/` no
  Cloudflare Pages (git-connected, builda no push da `main`)», e a diferença não é de detalhe: com ela eu
  levantei, na issue #111, um bloqueio que não existe — *«quando a engine esvaziar, o push seguinte publica
  uma página vazia»*. Não publica nada, porque nada publica. Enquanto não houver conexão, **push não é
  publicação**, e a saída do build (`dist/`) só chega a alguém por um passo manual.
- **TypeScript + Vite** (build) + **Vitest** (node + browser/Playwright) + **vite-plugin-pwa** (SW por content-hash).
  ⚠️ **`npm run typecheck` tem de sair LIMPO — zero erros, em qualquer arquivo.** Foram 273 no `main.ts` no dia
  da conversão, tolerados por um gate com orçamento que só descia (`scripts/check-types.mjs`); chegaram a zero
  em 2026-08-26 e o gate saiu. Não há mais dívida conhecida para tolerar: um erro novo é um erro seu.
  **Node 24** (`.node-version`). Detalhes: `docs/plano-typescript-vite.md`, `docs/plano-testes.md`.
- **Versão:** `release-it` (você dispara) + carimbo `git describe` injetado pelo Vite (`__BUILD__`).
  Ver `docs/plano-versionamento.md`.

## 3. Onde estamos + roadmap

- **Agora:** **Estágio 4 — modularização** do `game.js` em ES Modules `.ts`, cada um extraído **com teste**
  (ZOMBIES + Right-BICEP). Alvo/ordem: `docs/plano-modularizacao-mapa.md`. **Fundamentos** que guiam a quebra
  (coesão↑, acoplamento↓, DI, DAO, adapters — base arXiv:2409.15152): `docs/plano-modularizacao.md` (= o ADR).
- **Roadmap por dependência** (fases como issues **Fase 0–6** no GitHub; a estratégia/
  ordem em `docs/ROADMAP.md`):
  0 publicar ✅ · 1 nível-glifo + editor de mapa · **2 espinha da engine = a modularização atual** · 3 arte
  procedural semântica · 4 editor de arte + importadores · 5 i18n en/es · 6 features (**Alfabetização 6–9**, webcam/
  voz, refinos, auditoria WCAG/GAG). Alfabetização é **Fase 6** — vem depois da base limpa + arte + i18n.

## 4. Convenções do projeto (obrigatórias)

- **Denso e auditável:** justifique escolhas não óbvias em ≤1 frase, com fonte primária quando couber.
- **Research-first:** estude + monte uma **tabela de resultados esperados (com fontes)** ANTES de propor/codar.
  Sem go-horse; defina a saída esperada e onde avaliar antes de testes caros.
- **Commits FREQUENTES e atômicos** (um bloco lógico por commit; nunca um "initial" gigante). Sem caminhos
  absolutos em arquivos versionados; to-dos pessoais ficam em arquivo git-ignored, não no README.
- **a11y honesto:** não vender "AAA em bloco" — marcar onde só dá AA (detalhe em §1).
- **DESIGN DE MENU (decisão do Dev, 2026-08-25): a explicação mora no RODAPÉ, e fica lá.** A linha carrega o
  rótulo curto em `<strong>` e nada mais à vista; toda a prosa entra num único `.opt-hint` dentro do `<span>`,
  que a casca (`ui/settings-panel` → `fillExplain`) MOVE para o rodapé `.opt-explain` (`aria-live`), mostrado
  ao foco/hover. A introdução do painel, quando houver, é o texto de REPOUSO desse rodapé, via
  `data-explain-idle` no `.overlay__card` — **nunca** um `<p>` de prosa no topo. Menu é menu de videogame/TV,
  não arquivo `.conf`. **Painel que re-renderiza precisa chamar `fillExplain` a cada render**, senão a prosa
  volta para dentro das linhas no primeiro clique.
- **AS TRÊS ZONAS DA TELA (decisão do Dev, por Gestalt):** *"O menu de acessibilidade é uma coisa, e deve ficar no
  **cabeçalho**; o menu de opções com botões amarelos é outra e deve ocupar o **espaço de trabalho** na tela; e a
  legenda é outra coisa, e deve ficar no **rodapé**."* Função separa, proximidade não agrupa. É a regra que responde
  à reclamação que já veio duas vezes — *"eu peço para mudar um ponto e você muda vários outros desnecessariamente"*:
  com as zonas escritas, "está perto" deixa de ser critério para mover coisa. O ADR-0044 já executou a primeira
  (a barra rápida foi para o HUD).

## 5. Testes

Vitest com dois *projects*: **node** (lógica pura, sem PIXI/DOM) e **browser**/Playwright (render/DOM). Cada
módulo extraído nasce com teste. **Eu rodo o Vitest** (medido em 04/09) e cada gate
nasce **vermelho com a mutação confirmada** antes de valer — verde que nunca pôde ficar vermelho não prova
nada, e já aconteceu aqui: uma regex morreu em silêncio e a checagem seguiu verde. Padrões: **ZOMBIES** (didático) + **Right-BICEP** (rigor). `docs/plano-testes.md`.
- **Hardware-alvo (Positivo/Chromebook):** montar baterias de teste para rodar **quando os aparelhos existirem**,
  conforme o produto evolui — não bloqueia o desenvolvimento agora (não temos os aparelhos ainda).

## 6. Onde achar (não duplico aqui — fato duplicado apodrece)

- **Mapa da documentação:** `docs/ARCHITECTURE.md` (estrutura de arquivos) + `docs/CONTRIBUTING.md` (como
  trabalhamos + modelo de documentação). **Comece por aí.** (Health files — CONTRIBUTING/CREDITS/SECURITY/**LICENSES** —
  vivem em `docs/`, não na raiz; o GitHub também os reconhece lá. A automação é o `.github/workflows/`.)
- **Documentação canônica por fase SDD:** `docs/1-Discovery/` (**software/engine**: User-Stories·NFR·Design·Event-Storming),
  `docs/educational/` (**camada currículo/pedagogia, pt-BR**: Learning-Objectives·Curriculum-Map·Pedagogical-Model + planos educacionais),
  `docs/2-Architecture/` (C4·adr **YADR**·Feature-Flags·DFD·STRIDE·CI-CD·learning-interop·backend-cloud-roadmap·K8s),
  `docs/3-Sprint-Design/` (data-model·api·bdd·Test-Plan), `4-Sprints`·`5-Refactoring`·`6-DevOps-SRE`·`7-Async-Systems`,
  `docs/research/` e `docs/legacy/`. **Discovery = software; pedagogia = educational/** (ADR-0004).
- **Currículo em CÓDIGO:** `app/js/educational/` — a metade em código da mesma camada (ADR-0032). É DADO: não
  importa nada (nem `core/`, nem `game/`), e o texto pt-BR dele **não entra nos dicionários**, porque o pilar 3
  manda *reescrever* currículo por idioma, não traduzir. ⚠️ **Ganhou dono em 2026-08-28**: vai para
  `the-inclusionist-knowledge-tree` (ADR-0058), que é o grafo de skills entre currículos de vários países — o
  primeiro endereço real que esta camada tem, depois de anos pertencendo a uma plataforma que não existia. Até a
  mudança acontecer, o catálogo mora aqui com a forma do destino. `tests/engine-boundary.node.test.js` é o gate.
- **Constantes do motor** (TILE_TYPES, TUNE, tiles, dimensões): `app/js/core/constants.ts` (fonte única, tipada).
- **Planos legados** (`docs/plano-*.md`, `PESQUISA-*`, etc.): **ainda
  na raiz de `docs/`**, sendo migrados **arquivo por arquivo, com revisão de conteúdo** (nada automático) para dentro
  da árvore canônica acima — issue `#1`. Até migrar, coexistem.

> ⚠️ **Migração em curso:** o esqueleto canônico (fases 1–6) já existe; o conteúdo dos ~30 arquivos soltos está sendo
> transferido para dentro dele, revisado um a um. Não crie doc novo na raiz de `docs/` — use a árvore de fases.

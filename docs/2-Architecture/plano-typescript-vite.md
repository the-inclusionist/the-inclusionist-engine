# Migração para TypeScript + Vite

Decisão do José (2026-07-04): migrar de "ESM cru sem build" para **TypeScript + Vite (com build)**, AGORA (24
módulos extraídos — mais barato que depois). Muda a *preferência* "sem build step"; os **pilares inegociáveis**
(PWA offline, runtime enxuto, hardware de escola) são **preservados/melhorados** (bundle/minify/tree-shake =
payload menor; `vite-plugin-pwa` gera o SW offline). Ver [[project-inclusionist]].

## Princípios
- **Incremental, sem big-bang.** `allowJs: true` → `.js` e `.ts` coexistem; converte-se módulo a módulo. A
  modularização em curso continua, mas cada peça nova/extraída nasce/vira `.ts` com tipos + testes.
- **strict frouxo no início**, apertando aos poucos (evita 1000 erros no dia 1).
- **Verificação:** a IA não roda Node → o José roda `npm run dev`/`build`/`vitest`. O preview (python servindo cru)
  ainda cobre os estágios iniciais; depois do build/PWA, a validação é via Vite.
- **1 estágio por vez, cada um validado antes do próximo.**

## Estágios

### Estágio 0 — Vite serve o jogo atual (dev) ✅ FEITO
Objetivo: provar que o toolchain roda com o mínimo de mudança (PIXI segue global do vendor; nada de TS ainda).
- `package.json`: devDeps `vite` + `typescript`; scripts `dev`/`build`/`preview`. Vitest alinhado ao major do Vite.
- `vite.config.ts`: `root: 'app'` (onde está o index.html). Em DEV o Vite serve TUDO sob `app/` (js/css/assets/
  vendor) → `fetch('assets/…')` e o `<script vendor/pixi.min.js>` funcionam sem mover nada.
- `tsconfig.json`: `allowJs`, `checkJs:false`, `noEmit` (o Vite emite; o tsc só faz type-check), `strict:false`.
- O SW artesanal é **desligado no dev** (evita conflito com o Vite) — volta como plugin no Estágio 1.
- **José valida:** `npm install` → `npm run dev` → o jogo abre em `localhost:5173` igual a hoje.

### Estágio 0b — `vite build` gera `dist/` ✅ FEITO
- Configurar cópia dos estáticos runtime (`assets/`, `vendor/`, `manifest`, `icon`, `_headers`) para o build —
  mover para `app/public/` (o Vite copia `public/*` para `dist/` na mesma URL). index.html quase intacto.
- **José valida:** `npm run build` → `npm run preview` serve o `dist/` funcionando.

### Estágio 1 — PWA pelo `vite-plugin-pwa` ✅ FEITO (SW Workbox ativo, offline verificado 2026-07-04)
- Substitui o `sw.js` artesanal + o ritual de bump `INCL_VERSION`: o plugin gera o SW com precache por
  **content-hash** (cache invalida sozinho). Estratégia offline preservada (precache do shell + assets).
- Remove `app/sw.js` e o registro inline; o plugin injeta o registro.
- **José valida:** build + `preview`, testar offline (DevTools → Offline) + atualização.

### Estágio 2 — Vitest alinhado ao Vite ✅ FEITO (Vitest 3.2.6, test.projects, 46 testes verdes)
- Bump `vitest`/`@vitest/browser` ao major compatível com o Vite instalado. Os dois projects (node/browser) e os
  testes atuais seguem; só a versão/ço​nfig ajusta. **José valida:** `npx vitest run` verde.

### Estágio 3 — Converter para `.ts` (incremental) + PIXI via npm ⬅ EM ANDAMENTO
- Renomear módulos `.js`→`.ts` e tipar, começando pelos **folha puros**. `strict:true` já ligado (só `.ts` checado).
  Progresso por **lotes** pequenos (cada um validado pelo José: `build` + `vitest run` + `tsc --noEmit`):
  - **Lote 1 (FEITO):** `core/constants`, `core/rng`, `core/tiles`.
  - **Lote 2 (FEITO):** `core/world`, `input/state`, `platform/storage`.
  - **Lote 3 (FEITO):** `input/devices`, `render/viz-modes`, `core/loop`, `ui/fonts`.
  - **Lote 4 (FEITO):** `core/i18n`, `input/keyboard`, `platform/audio-mixer`, `platform/speech`.
  - **Lote 4b (FEITO):** dicionários `i18n/{pt,en,es}` → `.ts`. O `import()` dinâmico "cru" foi trocado por
    `import.meta.glob('../i18n/*.ts')` (nativo do Vite: casa `.ts` no build explicitamente, sem depender do
    glob "adivinhado" pelo Rollup). pt segue import **estático** (boot síncrono); en/es entram como chunks
    sob demanda. **Validar no preview** a troca de idioma (glob só é exercitado em `build` + `preview`).
  - **Lote 5 (FEITO):** `ui/dom` (`$`/`$$` genéricos), `core/state`, `platform/audio` (grafo Web Audio tipado).
  - **Lote 6a (FEITO — PIXI global→npm):** `game.js` + `render/{canvas,sprites}` passam a `import * as PIXI from
    'pixi.js'` (7.4.2); removido o `<script src=vendor/pixi.min.js>` e o próprio arquivo (peso morto). Passo de
    MAIOR risco (mexe no boot/canvas) → **validar boot real no preview (canvas≥1 + `__incl`) após o build do José.**
  - **Lote 6b (FEITO — render→.ts):** `render/{canvas,props,sprites,sprite-fx}` tipados com os `@types` do pixi.js.
  - Resta só o **`game.js`** como `.js` (o grande) → **Estágio 4** (modularização continua, cada extração nasce `.ts`).
- **Módulos de render** (canvas, props, sprites, sprite-fx): lote dedicado — trocar o `PIXI` global por
  `import * as PIXI from 'pixi.js'` (dep real, tree-shakeável, tipada). `$` de ui/dom vira helper **tipado** (`$<T>()`).
- Cada conversão: `tsc --noEmit` limpo + testes verdes.

### Estágio 4 — Retomar a modularização em `.ts`
- O resto do mapa (`../5-Refactoring/plano-modularizacao-mapa.md`) segue, mas cada extração já nasce `.ts` tipada. O `game.ts`
  (ex-`game.js`) encolhe até virar `main.ts` (composition root).

## Deploy (Cloudflare Pages) — ação do José
O projeto Pages `the-inclusionist` foi criado na era sem-build (servia `app/` cru) e **estava conectado ao
GitHub**. Com a mudança para o GitLab a origem precisa ser refeita — um projeto Pages não troca de repositório
no lugar. **Build settings** (na UI atual do dashboard — não cravar caminhos de menu, que mudam):
- **Root directory:** raiz do repo (onde está o `package.json`) — NÃO `app/`.
- **Build command:** `npm run build` (ou `npm run test:node && npm run build` p/ um gate de testes).
- **Build output directory:** `dist`.

O `_headers` sai no `dist/` (via `public/`). Node já existe no build do CF. **Um único caminho de entrega pode
estar ligado por vez** — ou o CF conectado ao GitLab (ele mesmo builda), ou o job `pages_deploy` do
`.gitlab-ci.yml` (upload direto por `wrangler`). Os dois juntos deployam duas vezes o mesmo commit.

## Riscos / notas
- **Config de Vite/PWA costuma precisar de 1–2 iterações na máquina real** — mando a config, você roda, me cola o
  erro, eu ajusto (como foi no browser mode do Vitest).
- **Alinhamento de versão Vite↔Vitest** é o ponto mais provável de atrito no `npm install` — resolvemos no 1º run.
- **Preview da IA** perde fidelidade após o Estágio 0b (build/PWA) — a validação passa a ser sua via Vite. Meu
  graph-check em Python vira redundante (o `tsc` faz melhor).
- Nada disso muda o jogo em runtime para o usuário além de **melhor** (payload menor, SW mais robusto).

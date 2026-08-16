# Plano de Testes — The Inclusionist

Testes de unidade dos módulos, escritos **conforme cada módulo é extraído** (decisão do José, 2026-07-04; ver
`../5-Refactoring/plano-modularizacao.md` §8). Padrões adotados: **ZOMBIES** (didático) + **Right-BICEP** (rigor obrigatório).

## 1. Por que testar por extração (e com redundância)
O momento da extração é quando o contrato do módulo está mais claro → teste mais barato de escrever, e rede de
segurança para as extrações grandes/acopladas que vêm depois. A verificação é **redundante de propósito** (decisão
do José) — dois caminhos independentes pegam mais coisa:

| Camada | Quem roda | O quê |
|---|---|---|
| **Grafo estático** | IA (script Python) | todo `import {..}` casa com um `export`? Imune a cache. |
| **Boot real** | IA (preview) | `canvasCount≥1` + `window.__incl` — o jogo inteiro sobe? Ver [[feedback-verify-game-actually-boots]]. |
| **Vitest** | **José** (`npx vitest`) | unidade real: node (lógica) + Chromium/Playwright (render). CI-ready. |

**Harness de navegador APOSENTADO (2026-07-04, Estágio 0b da migração TS+Vite):** o `app/tests/` foi removido — pós-Vite ficava awkward de servir e a dupla-manutenção não compensava. O **Vitest (José) é o caminho único** de teste; a verificação da IA por extração vira **grafo + boot** (servindo o `dist/` buildado) + pré-validação ad-hoc das expectativas no preview.

## 2. Os dois padrões

### ZOMBIES (James Grenning) — heurística de ORDEM e cobertura (didática p/ TDD)
Ordena o pensamento do teste, do trivial ao complexo — ótimo para um contribuinte iniciante ler a suíte e
entender *como se pensa* um teste:
- **Z**ero — o caso vazio/nenhum primeiro (string vazia, lista vazia, nada pressionado).
- **O**ne — um elemento.
- **M**any — vários (e a interação entre eles).
- **B**oundary behaviors — bordas.
- **I**nterface definition — a forma da API (tipos, contagens, enums).
- **E**xercise exceptional behavior — forçar o caminho de erro/exceção.
- **S**imple scenarios, simple solutions — manter simples.

### Right-BICEP (Hunt & Thomas, *Pragmatic Unit Testing*) — rigor OBRIGATÓRIO
Nenhum módulo "fecha" sem cobrir **Right + B + I + C + E** (P quando fizer sentido):
- **Right** — o resultado está certo no caminho feliz?
- **B**oundary — condições de borda. Sub-checklist **CORRECT**: **C**onformance (formato), **O**rdering (ordem),
  **R**ange (faixa), **R**eference (dependências externas/estado), **E**xistence (nulo/vazio/ausente),
  **C**ardinality (0/1/N — casa com ZOMBIES), **T**ime (ordem/temporização/concorrência).
- **I**nverse — relação inversa (ex.: `parseLevel` ↔ `gridToGlyphs` = identidade).
- **C**ross-check — validar por OUTRO caminho (ex.: `tiles.selfTest()` prova a bijeção independentemente).
- **E**rror conditions — forçar erros (entrada inválida, glifo desconhecido, JSON corrompido).
- **P**erformance — características de desempenho (raro aqui; usar se um módulo tiver custo relevante).

**Convenção de escrita:** cada teste leva um rótulo no nome — `[Zero]`, `[One]`, `[Many]`, `[Boundary]`,
`[Interface]`, `[Inverse]`, `[Cross-check]`, `[Error]`, `[Right]` — para a suíte ser autoexplicativa.

## 3. Arquitetura — Vitest com dois "projects"
Regra de design que isso impõe (e que é boa): **maximizar lógica pura** (testável em node, rápida) e **minimizar
a superfície só-de-navegador** (render). Ao extrair, evitar que módulos de lógica importem PIXI/`document`.

- **`node`** — lógica pura, sem `PIXI`/`document`/`localStorage`: `core/constants`, `core/tiles`, `core/world`,
  `input/state`, e a **física** quando for extraída. Arquivos `tests/*.node.test.js`. Rápido, sem browser.
- **`browser`** — precisa do ambiente real (Chromium via Playwright): `render/canvas`, `render/props`,
  `render/sprites`, `render/sprite-fx` (PIXI/canvas/WebGL) e `platform/storage` (localStorage). Arquivos
  `tests/*.browser.test.js`. `vitest.setup.browser.js` expõe `globalThis.PIXI` (pixi.js **7.4.2**, a MESMA
  major do `vendor/pixi.min.js`) para os módulos que leem `PIXI` global, igual ao jogo.

Tudo é **DEV-ONLY**: `package.json`/`node_modules`/`tests/` ficam na RAIZ do repo. O deploy do Cloudflare é a
pasta `app/`, então **nada disso vai pro jogo** — que continua **sem build/bundler** (pilar da leveza).

## 4. Como rodar (José)
```bash
npm install                     # instala vitest + @vitest/browser + playwright + pixi.js (dev)
npx playwright install chromium # baixa o Chromium do Playwright (1ª vez)
npx vitest run                  # roda tudo (node + browser), uma vez
npx vitest                      # modo watch
npm run test:node               # só a lógica (rápido)
npm run test:browser            # só o render (Chromium)
```
> Observação honesta: **eu (IA) não rodo Node neste ambiente** — escrevo os testes e a config, mas quem executa o
> Vitest é você. A config de *browser mode* pode variar com a versão do Vitest instalada; se algo reclamar,
> me mande a saída que eu ajusto. Enquanto isso, eu mantenho a verificação por grafo + boot (dist/) a cada rodada.

## 5. Cobertura e roadmap
- **Coberto (módulos-folha já extraídos):** constants, tiles, world, input/state (node); canvas, props, sprites,
  sprite-fx, storage (browser). Ver `tests/logic.node.test.js` e `tests/render.browser.test.js`.
- **Cada próxima extração** adiciona seus testes no arquivo do project certo, cobrindo Right+B+I+C+E.
- **Física** (quando extraída de `game.js`): alvo prioritário de testes node (pulo, gravidade, água, trampolim,
  colisão) — determinística, alto valor. É o maior ganho da suíte.
- **CI:** ✅ o GitLab CI (`.gitlab-ci.yml`) roda a suíte no push da `main` e em merge request — trava regressões.

## 6. (Aposentado) Harness de navegador
O `app/tests/` (index.html + suite.js) foi REMOVIDO no Estágio 0b da migração TS+Vite (2026-07-04). Motivo: pós-
Vite ele ficava awkward de servir e a dupla-manutenção com o Vitest não compensava (o Vitest cobre o mesmo). O
caminho de teste passa a ser SÓ o Vitest; a IA verifica cada extração por grafo (Python) + boot no `dist/`
buildado + pré-validação das expectativas no preview.

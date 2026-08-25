import { defineConfig } from 'vitest/config'; // (não de 'vite': é o vitest/config que tipa o campo `test`)
import { VitePWA } from 'vite-plugin-pwa';
import { playwright } from '@vitest/browser-playwright'; // Vitest 4: provider virou factory de pacote próprio
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Plugin em .mjs puro (sem tipos): é ferramenta de BUILD, e tipá-la exigiria um segundo tsconfig para o
// Node. O contrato dele é uma função que devolve o objeto de plugin, e o Vite valida isso na hora de usar.
import atlasDeSprites from './scripts/vite-plugin-atlas.mjs';
const RAIZ_SPRITES = join(dirname(fileURLToPath(import.meta.url)), 'app/public/assets/sprites/menino');

// CARIMBO DE BUILD (versionamento — ver docs/plano-versionamento.md). git describe dá a versão: no commit de uma
// tag de release (feita pelo release-it), sai limpa (v4.165.0 = "versão de marketing"); nos demais, tag+ahead+sha;
// com mudanças não commitadas, sufixo -dirty. Fallbacks: CF Pages faz clone RASO → se as tags não vierem (build
// command deve fazer `git fetch --tags --force`), cai no CF_PAGES_COMMIT_SHA; sem git, 'dev'. Injetado via define.
const sh = (cmd: string): string => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const cfSha = (process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7);
const BUILD = {
  version: sh('git describe --tags --always --dirty') || cfSha || 'dev',
  sha: sh('git rev-parse --short HEAD') || cfSha || 'dev',
  date: sh('git log -1 --format=%cd --date=short') || '', // data do COMMIT (estável entre rebuilds do mesmo commit)
  env: process.env.CF_PAGES ? 'prod' : 'local',
};

// Migração TS+Vite (docs/plano-typescript-vite.md). root=app/ (index.html) p/ dev/build.
// PWA (Estágio 1): o vite-plugin-pwa gera o SW (Workbox) e o manifest — aposenta o sw.js artesanal e o bump
// manual de INCL_VERSION. Precache do shell + assets por CONTENT-HASH → cache invalida sozinho; registerType
// 'autoUpdate' aplica a versão nova no próximo load (resolve o "build velho preso" por construção).
// A config de TESTE vive aqui (Vitest 3 deprecou o workspace → test.projects; cada project usa root=raiz do repo).
export default defineConfig({
  root: 'app',
  define: { __BUILD__: JSON.stringify(BUILD) }, // carimbo de build (versão/sha/data/env) — main.js lê __BUILD__.version
  plugins: [
    // O ATLAS DE SPRITES (item 22, X2): 39 requisições viram UMA. Empacota em tempo de build com
    // `scripts/atlas.mjs` — zero dependência nova — e entrega o manifesto pelo módulo virtual
    // `virtual:sprite-atlas`, para o boot continuar SÍNCRONO (um .json ao lado seria a 2ª requisição).
    atlasDeSprites({ raizSprites: RAIZ_SPRITES }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // o plugin injeta o registro do SW no index.html (offline)
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'The Inclusionist',
        short_name: 'Inclusionist',
        description: 'Jogo educativo de plataforma acessível (PixiJS · WCAG 2.2 + GAG).',
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0b1020',
        theme_color: '#0b1020',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // precacheia TUDO que o jogo usa offline: bundle (js/css/html) + sprites (png) + fontes (woff2) +
        // nível (txt) + tileset (json) + ícone (svg). O maior arquivo é o pixi (445KB) < 2MB (limite default).
        // `wasm` entra aqui para o runtime do TTS neural (sherpa-onnx/ort, ~25,6 MB) ser PRECACHEADO.
        // Sem ele o arquivo ficava fora do cache do PWA — e sem `runtimeCaching` tambem — entao dependia do cache
        // HTTP comum, que o navegador despeja quando quer: em laboratorio de escola com maquina restaurada, a voz
        // neural simplesmente nao carregava offline (pilar 8). O teto por arquivo SOBE junto porque o padrao do
        // Workbox e 2 MB: so acrescentar a extensao faria ele PULAR o arquivo com um aviso, e o sintoma seria
        // identico ao de antes. A troca e consciente: o precache passa de ~2 MB para ~28 MB, e a primeira visita
        // online passa a baixar tudo — que e exatamente o contrato de um PWA que precisa funcionar sem rede depois.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,txt,json,webmanifest,wasm}'],
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024, // 32 MB: cabe o runtime de 25,6 MB com folga
        cleanupOutdatedCaches: true,
        // A ARTE NUNCA MAIS ATUALIZAVA, e ninguem veria: o padrao do vite-plugin-pwa e
        // `dontCacheBustURLsMatching = /^assets/` — ele assume que TUDO sob `assets/` tem hash no nome, o que
        // vale para o que o Vite emite e NAO vale para `app/public/assets/**`, que e copiado verbatim. Os 38
        // PNGs do personagem, os 3 fundos da Cidade e o `clarity.map.txt` entravam no precache com
        // `revision: null`, e `revision: null` quer dizer "o hash esta no nome": o Workbox guarda uma vez e
        // nunca mais busca. Trocar a arte deixava a crianca com a arte velha para sempre — e em laboratorio
        // de escola esse e justamente o cache que sobrevive.
        // O padrao abaixo casa SO o que o Vite hasheia de verdade: UM segmento sob `assets/`, terminado em
        // `-<hash de 8+>`. Tudo o mais passa a ganhar revisao por CONTEUDO, que e o que faz o cache virar.
        // Falso positivo possivel e assumido: um arquivo de `public/assets/` na raiz chamado `foo-abcdefgh.png`
        // seria lido como hasheado. `scripts/check-precache.mjs` e o gate que vigia o resultado, nao a regra.
        dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^.]+$/,
      },
      // PWA fica DESLIGADA no dev (default) — sem SW/cache atrapalhando o HMR; testar via `npm run build` + `preview`.
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    // PixiJS (~445KB) em chunk PRÓPRIO (Vite 8/rolldown: output.codeSplitting.groups). Motivo: o engine quase
    // nunca muda, o main.js muda a cada commit. Com pixi separado, seu hash fica estável entre deploys → o
    // precache do Workbox NÃO rebaixa os 445KB a cada atualização (só o chunk pequeno do jogo re-baixa) — ganho
    // real de banda p/ o pilar offline/máquina fraca. Efeito colateral: os 2 chunks ficam < 500KB → sem o aviso.
    rolldownOptions: {
      // DUAS páginas: o jogo e o SEGUNDO CONSUMIDOR (ADR-0027 passo 6). Mora aqui, e não em `rollupOptions`,
      // porque este projeto builda com ROLLDOWN — o campo do rollup é ignorado em silêncio, e o único sintoma
      // é o `dist/quiz.html` que não aparece. O consumidor existe para medir a fronteira engine↔jogo, e um
      // consumidor que não é construído de verdade não mede nada.
      input: { main: 'app/index.html', quiz: 'app/quiz.html' },
      output: {
        codeSplitting: {
          groups: [
            { name: 'pixi', test: /node_modules[\\/](@pixi|pixi\.js)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        // lógica pura (rápido, sem browser)
        root: import.meta.dirname,
        // O PLUGIN DO ATLAS ENTRA AQUI TAMBÉM: os projects de teste NÃO herdam os plugins do topo, e
        // `render/sprites` importa o módulo virtual. Sem isto, `tests/logic.node.test.js` falha ao RESOLVER —
        // não ao afirmar —, que é a forma de quebra mais confusa possível numa suíte.
        plugins: [atlasDeSprites({ raizSprites: RAIZ_SPRITES })],
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.node.test.js'],
        },
      },
      {
        // render/DOM real via Chromium/Playwright (Vitest 3: browser.instances)
        root: import.meta.dirname,
        plugins: [atlasDeSprites({ raizSprites: RAIZ_SPRITES })],
        test: {
          name: 'browser',
          include: ['tests/**/*.browser.test.js'],
          setupFiles: ['./vitest.setup.browser.js'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});

import { defineConfig } from 'vitest/config'; // (não de 'vite': é o vitest/config que tipa o campo `test`)
import { VitePWA } from 'vite-plugin-pwa';
import { playwright } from '@vitest/browser-playwright'; // Vitest 4: provider virou factory de pacote próprio
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
// Plugin em .mjs puro (sem tipos): é ferramenta de BUILD, e tipá-la exigiria um segundo tsconfig para o
// Node. O contrato dele é uma função que devolve o objeto de plugin, e o Vite valida isso na hora de usar.
// ⚠️ O PLUGIN DO ATLAS SAIU COM O CARTUCHO (issue #111). Ele gera `virtual:sprite-atlas`, que so'
// `render/sprites` importava — e `render/sprites` nao e' engine: o `tsconfig.pkg.json` ja' o excluia do
// pacote por escrito. Os dois vivem agora em `game-platformer`, junto com o `scripts/atlas.mjs`.


// ========================= CARIMBO DE BUILD (docs/plano-versionamento.md) =========================
// A VERSÃO VEM DO `package.json`, e não do `git describe`. Foi assim até 2026-08-26, e o defeito era este:
// `git describe --tags` só devolve uma versão se houver TAG ALCANÇÁVEL, e não há nenhuma — nem local, nem no
// remoto (`git ls-remote --tags origin` volta vazio). Sem tag, o `--always` cai no SHA curto, e o jogo
// mostrava `vbbfa193` no título em vez da versão de verdade. O `package.json` diz a versão, está VERSIONADO, e
// chega em qualquer clone: raso, sem tags, no CF Pages, em qualquer lugar. Não há como ele faltar.
//
// O `git describe` continua, e continua servindo para o que ele é bom: dizer se este build corresponde a uma
// versão publicada ou não. O sufixo `+<sha>` aparece quando o build está ADIANTE da tag da versão, e
// `-dirty` quando há mudança não commitada — e esse aviso vale: um artefato marcado `-dirty` não corresponde
// a commit nenhum, e não dá para pedir de volta.
//
// Sintaxe de metadados de build do semver (`6.36.1+bbfa193`), que é o lugar certo para isso.
//
// Fallbacks: sem git, sobra o `CF_PAGES_COMMIT_SHA`; sem ele, 'dev'.
const sh = (cmd: string): string => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const cfSha = (process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7);
const RAIZ_REPO = dirname(fileURLToPath(import.meta.url));
const versaoDoPacote = ((): string => {
  try { return String(JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8')).version || ''); } catch { return ''; }
})();
const descricaoGit = sh('git describe --tags --always --dirty'); // vX.Y.Z · vX.Y.Z-3-gabc1234 · abc1234-dirty
const shaCurto = sh('git rev-parse --short HEAD') || cfSha || 'dev';
/** `6.36.1` num build de release; `6.36.1+bbfa193` adiante dela; `+bbfa193-dirty` com árvore suja. */
const versaoDeExibicao = ((): string => {
  if (!versaoDoPacote) return descricaoGit || cfSha || 'dev';        // sem package.json legível: o que houver
  if (descricaoGit === 'v' + versaoDoPacote) return versaoDoPacote;   // exatamente na tag desta versão
  const sujo = descricaoGit.endsWith('-dirty') ? '-dirty' : '';
  return versaoDoPacote + '+' + shaCurto + sujo;
})();
const BUILD = {
  version: versaoDeExibicao,
  sha: shaCurto,
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
        // ========================= A ROTA QUE FAZ OS 241 MB SERVIREM PARA ALGUMA COISA =========================
        // 🔴 MEDIDO EM 2026-09-09: o `platform/pesados` descia os quatro modelos de voz no primeiro
        // carregamento e guardava-os na Cache Storage `incl-pesados-v1` — e NINGUEM OS LIA. A Cache Storage
        // nao e consultada sozinha por um `fetch`: sem uma rota do service worker, o pedido da biblioteca de
        // voz ia direto a rede e descarregava os mesmos 241 MB outra vez. Ate 482 MB num link de escola para
        // UMA voz.
        // 🎯 `CacheFirst` com o MESMO nome de cache que o buscador usa e o que fecha o circuito: o pedido
        // encontra o que ja desceu, e nunca sai da maquina. Um `NetworkFirst` seria o oposto do pilar 8 —
        // iria a rede primeiro e so recuaria para a cache quando a escola estivesse offline, que e
        // exatamente o dia em que ja e tarde.
        // ⚠️ E o alcance e ESTREITO de proposito: so o host dos modelos, nomeado no
        // `platform/voice-plan.HOST_DOS_MODELOS`. Uma rota larga sobre `huggingface.co` cacharia qualquer
        // coisa que alguem viesse a buscar de la, o que e a porta larga que a #119 fechou noutro sitio.
        // 📌 Um crivo prende os dois lados juntos (`tests/rota-dos-modelos.node.test.js`): a rota tem de
        // nomear o mesmo host e o mesmo nome de cache que o codigo usa, senao ela existe e nao serve nada.
        runtimeCaching: [
          // Os RUNTIMES fixados (MediaPipe e piper/onnxruntime), pela mesma razao e com a mesma cache: o
          // buscador desce-os na instalacao e sem rota o `import()` deles iria a rede outra vez. ⚠️ O alcance
          // e por PACOTE e nao por dominio — `cdn.jsdelivr.net` inteiro seria a porta larga que a #119 fechou.
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@mediapipe\/tasks-vision|@mintplex-labs\/piper-tts-web|onnxruntime-web)@/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'incl-pesados-v1',
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/huggingface\.co\/diffusionstudio\/piper-voices\/resolve\/main\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'incl-pesados-v1',
              // Sem isto o Workbox recusa guardar respostas opacas; as do Hugging Face vem com
              // `Access-Control-Allow-Origin: *` (medido), entao 0 nao e necessario e seria pior — uma
              // resposta opaca de 60 MB conta como muito mais no orcamento de quota do navegador.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
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
        // A SEGUNDA PÁGINA NÃO É UMA ROTA DO JOGO — e sem esta linha ela some quando o SW está no caminho.
        //
        // O `generateSW` cria uma `NavigationRoute` que devolve o shell precacheado (`index.html`) para
        // QUALQUER navegação. É o comportamento certo para uma aplicação de página única, e é o que faz um
        // link profundo abrir o jogo. Mas o `vite.config` registra DUAS páginas de propósito: o jogo e o
        // SEGUNDO CONSUMIDOR do ADR-0027 passo 6, que existe para MEDIR a fronteira engine↔jogo. Um
        // instrumento construído no build e apagado em produção não mede nada.
        //
        // Hoje ele sobrevive porque a rota de precache casa `/quiz.html` ANTES da rota de navegação —
        // conferido no navegador com o SW controlando. Isso é ORDEM DE ROTAS, não garantia: basta o
        // `quiz.html` faltar no manifesto por um instante (SW velho, precache parcial, atualização a meio)
        // para a navegação cair no shell do jogo. A issue #73 registrou exatamente esse sintoma em
        // 2026-08-25 e ele não reproduz mais; nada na configuração mudou entre lá e cá, o que deixa "service
        // worker velho" como explicação mais provável — e é justamente o caso que esta linha cobre.
        navigateFallbackDenylist: [/^\/quiz\.html$/],
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
      input: { quiz: 'app/quiz.html' }, // ⚠️ `main` saiu com o cartucho (#111): a engine nao tem app proprio
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
        test: {
          name: 'node',
          environment: 'node',
          // `.ts` entra junto por causa dos testes de TIPO (ADR-0039): a metade de compilação deles é
          // conferida pelo `tsc`, mas o ADR exige que eles rodem no comando que a pipeline já roda, e não
          // num ritual separado — um teste que ninguém executa é decoração.
          include: ['tests/**/*.node.test.{js,ts}'],
        },
      },
      {
        // render/DOM real via Chromium/Playwright (Vitest 3: browser.instances)
        root: import.meta.dirname,
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

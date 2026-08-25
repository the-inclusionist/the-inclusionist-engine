// SPDX-License-Identifier: AGPL-3.0-or-later
// scripts/vite-plugin-atlas — o plugin que EMPACOTA os sprites no build (item 22, X2).
//
// Usa `scripts/atlas.mjs` (decodificador/codificador/empacotador, sem dependência nova) e entrega duas coisas:
//
//   · `assets/sprite-atlas.png` — UM arquivo, no lugar dos 39 quadros soltos.
//   · o módulo virtual `virtual:sprite-atlas` — o manifesto `nome → {x,y,w,h}` como DADO NO BUNDLE.
//
// ========================= POR QUE O MANIFESTO VAI NO BUNDLE, E NÃO NUM .json =========================
// Um `.json` ao lado do PNG seria a segunda requisição, e o item existe para MATAR requisição. Ele também
// seria assíncrono, e `initCharacterSprites()` é síncrono e roda no boot — a alternativa seria tornar o boot
// assíncrono por causa de 1,6 KB de coordenadas. No bundle o manifesto é dado estático que já viaja no JS
// que a página carrega de qualquer jeito, e o boot continua síncrono.
//
// ========================= O QUE ENTRA NO ATLAS =========================
// Os PNG de `sprites/menino/**` MENOS as variantes `_hc`. Elas são 38 arquivos que NADA carrega — o alto
// contraste recolore o quadro de cor em tempo real (issue #71) — e um empacotador que não as recebe as tira
// do pacote por construção, em vez de por alguém lembrar de apagá-las.
//
// ========================= NOME FIXO, SEM HASH, E POR QUÊ =========================
// `assets/sprite-atlas.png` é nome fixo. O Workbox calcula a revisão pelo CONTEÚDO ao precachear, então o
// cache invalida sozinho quando a arte muda — o hash no nome não acrescenta nada e complicaria o módulo
// virtual (que teria de resolver `import.meta.ROLLUP_FILE_URL_*`). Menos peça, mesmo resultado.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodificarPng, codificarPng, empacotar, compor, manifesto } from './atlas.mjs';

const VIRTUAL = 'virtual:sprite-atlas';
const RESOLVIDO = '\0' + VIRTUAL;
export const CAMINHO_ATLAS = 'assets/sprite-atlas.png';

/** Todos os quadros de COR sob `raiz` (recursivo por animação), sem as variantes `_hc`. */
export function lerQuadros(raiz) {
  const out = [];
  if (!existsSync(raiz)) return out;
  for (const anim of readdirSync(raiz)) {
    const dir = join(raiz, anim);
    if (!statSync(dir).isDirectory()) continue;           // `_LEIA-ME.md` mora ao lado das pastas
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.png') || f.endsWith('_hc.png')) continue;
      const { w, h, px } = decodificarPng(readFileSync(join(dir, f)));
      out.push({ nome: anim + '/' + f.replace(/\.png$/, ''), w, h, px });
    }
  }
  return out;
}

/** Empacota e devolve `{ png, frames, largura, altura }`. Puro sobre a lista — testável sem Vite. */
export function construirAtlas(quadros, opcoes = {}) {
  const { largura, altura, postos } = empacotar(quadros, { largura: 256, ...opcoes });
  return { png: codificarPng(largura, altura, compor(largura, altura, postos)), frames: manifesto(postos), largura, altura };
}

/**
 * O plugin. `raizSprites` é absoluto; o atlas é construído UMA vez por build e reusado pelo módulo virtual e
 * pelo asset emitido — construir duas vezes daria dois PNG idênticos e duas listas de coordenadas que
 * PODERIAM divergir se alguma opção mudasse no meio.
 */
export default function atlasDeSprites({ raizSprites }) {
  let atlas = null;
  const garantir = () => (atlas ??= construirAtlas(lerQuadros(raizSprites)));

  return {
    name: 'inclusionist-sprite-atlas',

    resolveId(id) { return id === VIRTUAL ? RESOLVIDO : null; },

    load(id) {
      if (id !== RESOLVIDO) return null;
      const { frames } = garantir();
      return `export const ATLAS_URL = ${JSON.stringify(CAMINHO_ATLAS)};\n`
        + `export const FRAMES = ${JSON.stringify(frames)};\n`;
    },

    // BUILD: o PNG entra no bundle como asset de nome fixo.
    generateBundle() {
      const { png } = garantir();
      this.emitFile({ type: 'asset', fileName: CAMINHO_ATLAS, source: png });
    },

    // DEV: o mesmo PNG, servido da memória. O `preview` do projeto roda sobre `dist` (regra da casa), mas um
    // `vite dev` que servisse 404 no atlas deixaria o personagem invisível — falha visual, sem erro no console.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split('?')[0].endsWith('/' + CAMINHO_ATLAS)) return next();
        const { png } = garantir();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.end(png);
      });
    },
  };
}

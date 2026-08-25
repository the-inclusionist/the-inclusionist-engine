// SPDX-License-Identifier: AGPL-3.0-or-later
// OS TILES DA CIDADE contra a ARTE DE ORIGEM (project node: decodifica o PNG com o zlib do próprio node).
//
// O `render/city-tiles` afirma reproduzir `tile_fill.png` e `tile_surface.png` PIXEL A PIXEL. Uma afirmação
// dessas ou é medida ou é torcida — e a diferença aparece no dia em que alguém "arruma" um retângulo.
//
// O teste não usa PIXI nem canvas: ele executa o `PixelPainter` com um pincel de mentira que escreve numa
// matriz, e compara com o PNG decodificado. É o mesmo desenho que o navegador faria, sem navegador.
//
// ⚠️ EU ACHEI QUE ESTE TESTE MORRERIA COM O ITEM 18, e estava errado. A previsão era que os PNG seriam
// APAGADOS e o painter viraria a única fonte da verdade, sem nada contra o que comparar. O que aconteceu foi
// melhor: eles saíram do PACOTE e ficaram no REPOSITÓRIO, em `docs/art-ref`. Arte de autoria é fonte, não
// produto — não embarca, e continua existindo para responder "isto ainda é a mesma arte?".
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { paintTileFill, paintTileSurface } from '../app/js/render/city-tiles.js';

// A ARTE DE ORIGEM MUDOU DE LUGAR (#18): saiu de `app/public`, que EMBARCA, para `docs/art-ref`, que não.
// Ela deixou de ser asset do jogo no dia em que o `render/city-tiles` passou a desenhá-la — mas continua
// versionada, porque é contra ela que este teste afirma fidelidade. Arte de autoria é fonte, não produto.
const DIR = join(process.cwd(), 'docs', 'art-ref', 'cenarios', 'cidade');

/** PNG 8 bits (RGB/RGBA) → matriz de '#rrggbb'. Sem dependência nova: o IDAT é zlib e o filtro é o do spec. */
function decodePng(p) {
  const b = readFileSync(p);
  let off = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const tipo = b.toString('ascii', off + 4, off + 8);
    const d = b.subarray(off + 8, off + 8 + len);
    if (tipo === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (tipo === 'IDAT') idat.push(d);
    else if (tipo === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : 3, rb = w * ch, out = Buffer.alloc(h * rb);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const ln = raw.subarray(pos, pos + rb); pos += rb;
    const dst = out.subarray(y * rb, (y + 1) * rb);
    const prev = y ? out.subarray((y - 1) * rb, y * rb) : Buffer.alloc(rb);
    for (let i = 0; i < rb; i++) {
      const a = i >= ch ? dst[i - ch] : 0, cima = prev[i], diag = i >= ch ? prev[i - ch] : 0;
      let v = ln[i];
      if (f === 1) v += a;
      else if (f === 2) v += cima;
      else if (f === 3) v += (a + cima) >> 1;
      else if (f === 4) {
        const pp = a + cima - diag;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - cima), pc = Math.abs(pp - diag);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? cima : diag);
      }
      dst[i] = v & 255;
    }
  }
  const px = [];
  for (let y = 0; y < h; y++) {
    const linha = [];
    for (let x = 0; x < w; x++) {
      const i = y * rb + x * ch;
      linha.push('#' + [out[i], out[i + 1], out[i + 2]].map((n) => n.toString(16).padStart(2, '0')).join(''));
    }
    px.push(linha);
  }
  return { w, h, px };
}

/** Executa um PixelPainter num pincel de mentira: devolve a matriz que ele desenhou. */
function pintar(painter, w = 16, h = 16) {
  const m = Array.from({ length: h }, () => new Array(w).fill(null));
  painter((x, y, ww, hh, cor) => {
    for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
      if (y + j < h && x + i < w) m[y + j][x + i] = cor;
    }
  });
  return m;
}

const CASOS = [
  ['tile_fill.png', paintTileFill, 51],
  ['tile_surface.png', paintTileSurface, 62],
];

describe('render/city-tiles — a arte virou dados, e continua a mesma arte', () => {
  for (const [arquivo, painter, rects] of CASOS) {
    const p = join(DIR, arquivo);

    it(`[Right] ${arquivo}: cada pixel bate com o PNG de origem`, () => {
      // Se este caso falhar, ou o painter mudou ou a arte mudou. Os dois são notícia; nenhum é ruído.
      expect(existsSync(p), `${arquivo} sumiu de docs/art-ref — a referência de fidelidade não pode evaporar`).toBe(true);
      const alvo = decodePng(p);
      const meu = pintar(painter, alvo.w, alvo.h);
      const difs = [];
      for (let y = 0; y < alvo.h; y++) for (let x = 0; x < alvo.w; x++) {
        if (meu[y][x] !== alvo.px[y][x]) difs.push(`(${x},${y}) ${meu[y][x]} ≠ ${alvo.px[y][x]}`);
      }
      expect(difs.slice(0, 5), `${difs.length} pixel(s) divergem`).toEqual([]);
    });

    it(`[Zero] ${arquivo}: o painter cobre os 256 pixels — nenhum buraco`, () => {
      // Um buraco não apareceria na comparação acima se por acaso o PNG tivesse transparente ali; aqui
      // aparece sempre. Buraco num tile de parede é um furo por onde se vê o vazio do mundo.
      const meu = pintar(painter);
      const vazios = meu.flat().filter((c) => c === null).length;
      expect(vazios).toBe(0);
    });

    it(`[Interface] ${arquivo}: são ${rects} retângulos — o custo declarado no módulo`, () => {
      // O número está escrito no comentário do módulo. Se ele mudar sem o comentário mudar, o comentário
      // vira mentira — e comentário que mente é pior que comentário nenhum.
      let n = 0;
      painter(() => { n++; });
      expect(n).toBe(rects);
    });
  }
});

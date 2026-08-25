// SPDX-License-Identifier: AGPL-3.0-or-later
// scripts/atlas — O EMPACOTADOR DE SPRITES (item 22, opção X2), sem dependência nova.
//
// ========================= POR QUE X2, E POR QUE ZERO DEPENDÊNCIA =========================
// O Dev escolheu empacotar em tempo de BUILD (X2) e eu recomendei o contrário (X1). Retirei a recomendação:
// eu tinha medido BYTES — 66,8 KB, um sprite de jogador por vez — e atlas não compra bytes, compra
// REQUISIÇÕES. O próprio `render/sprites.ts` já registrava a medição que eu ignorei: 55 requisições para 38
// arquivos no boot, e o custo é LATÊNCIA em rede de escola com cache frio, invisível da máquina de quem
// desenvolve. O pilar 1 é máquina e rede de escola. (Ver ADR-0030, `more-information`.)
//
// SEM DEPENDÊNCIA NOVA porque a verba acabou e porque o projeto não usa CDN: PNG de 8 bits sem entrelace é
// `zlib` mais aritmética, e o `node:zlib` já está aqui. São ~100 linhas de decodificador e ~40 de codificador,
// e elas ficam TESTADAS — um codificador errado não estoura: ele produz arte silenciosamente corrompida.
//
// ========================= O QUE ELE FAZ, E O QUE ELE NÃO FAZ =========================
// Empacota SÓ O QUE FOR PASSADO. Isso não é detalhe: das 77 PNGs de sprite, 38 são variantes `_hc` que nada
// carrega (issue #71) — um empacotador que recebe a lista de arquivos referenciados as deixa de fora por
// construção, em vez de por alguém lembrar de apagá-las.
//
// NÃO redimensiona, NÃO recorta transparência e NÃO gira. Os quadros têm quinze tamanhos distintos e variam
// DENTRO da mesma animação (Art-Bible, medição de 2026-08-25); qualquer normalização mudaria a arte, e a arte
// não é minha para mudar. O empacotamento é lossless: os pixels que entram são os que saem.
import { deflateSync, inflateSync } from 'node:zlib';

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ===================== CRC-32, o que o PNG exige em cada bloco ===================== */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ===================== DECODIFICAR ===================== */

/** O byte anterior no MESMO pixel (a montante), ou 0 na primeira coluna. */
const aMontante = (linha, x, bpp) => (x >= bpp ? linha[x - bpp] : 0);

/**
 * Desfaz o filtro de uma scanline. São os cinco do PNG, e o Paeth é o único que não é óbvio: ele escolhe,
 * entre esquerda/acima/diagonal, o vizinho mais perto da soma dos três — é o preditor que a especificação
 * define, e escrevê-lo de memória é a forma mais fácil de corromper arte sem erro nenhum.
 */
function desfiltrar(tipo, linha, anterior, bpp) {
  const n = linha.length;
  if (tipo === 0) return;
  if (tipo === 1) { for (let x = bpp; x < n; x++) linha[x] = (linha[x] + linha[x - bpp]) & 255; return; }
  if (tipo === 2) { for (let x = 0; x < n; x++) linha[x] = (linha[x] + anterior[x]) & 255; return; }
  if (tipo === 3) {
    for (let x = 0; x < n; x++) linha[x] = (linha[x] + ((aMontante(linha, x, bpp) + anterior[x]) >> 1)) & 255;
    return;
  }
  if (tipo === 4) {
    for (let x = 0; x < n; x++) {
      const a = aMontante(linha, x, bpp), b = anterior[x], c = x >= bpp ? anterior[x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      linha[x] = (linha[x] + pr) & 255;
    }
    return;
  }
  throw new Error('atlas: filtro de PNG desconhecido: ' + tipo);
}

/**
 * Decodifica um PNG RGBA de 8 bits, sem entrelace. Devolve `{ w, h, px }` com `px` em RGBA.
 *
 * Recusa o que não entende em vez de adivinhar: profundidade diferente de 8, entrelace, ou tipo de cor que
 * não seja 6 (RGBA) ou 2 (RGB). Um decodificador que "tenta" produz arte errada sem uma linha de erro, e a
 * arte errada de um jogo de acessibilidade é justamente o que ninguém consegue conferir olhando.
 */
export function decodificarPng(buf) {
  if (!buf.subarray(0, 8).equals(ASSINATURA)) throw new Error('atlas: não é PNG');
  let i = 8, w = 0, h = 0, bits = 0, cor = 0, entrelace = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), tipo = buf.subarray(i + 4, i + 8).toString('latin1');
    const dados = buf.subarray(i + 8, i + 8 + len);
    if (tipo === 'IHDR') {
      w = dados.readUInt32BE(0); h = dados.readUInt32BE(4);
      bits = dados[8]; cor = dados[9]; entrelace = dados[12];
    } else if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'IEND') break;
    i += 12 + len;
  }
  if (bits !== 8) throw new Error('atlas: só 8 bits por canal (veio ' + bits + ')');
  if (entrelace !== 0) throw new Error('atlas: PNG entrelaçado não é suportado');
  if (cor !== 6 && cor !== 2) throw new Error('atlas: só RGBA(6) ou RGB(2) (veio tipo de cor ' + cor + ')');

  const canais = cor === 6 ? 4 : 3, bpp = canais, passo = w * canais;
  const cru = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  let anterior = Buffer.alloc(passo), pos = 0;
  for (let y = 0; y < h; y++) {
    const tipo = cru[pos++];
    const linha = Buffer.from(cru.subarray(pos, pos + passo)); pos += passo;
    desfiltrar(tipo, linha, anterior, bpp);
    for (let x = 0; x < w; x++) {
      const s = x * canais, d = (y * w + x) * 4;
      px[d] = linha[s]; px[d + 1] = linha[s + 1]; px[d + 2] = linha[s + 2];
      px[d + 3] = canais === 4 ? linha[s + 3] : 255;
    }
    anterior = linha;
  }
  return { w, h, px };
}

/* ===================== CODIFICAR ===================== */

function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])), 0);
  return Buffer.concat([len, t, dados, crc]);
}

/**
 * Codifica RGBA de 8 bits, sem filtro (tipo 0 em toda linha).
 *
 * SEM FILTRO É DELIBERADO. Filtrar renderia alguns por cento a mais de compressão e acrescentaria a única
 * parte do PNG que erra em silêncio — o preditor. O atlas tem dezenas de KB, não megabytes, e o que este
 * item compra é REQUISIÇÃO e não byte: pagar risco de corrupção por 3% de tamanho seria o mesmo erro de
 * medida que me fez recomendar X1.
 */
export function codificarPng(w, h, px) {
  const passo = w * 4;
  const cru = Buffer.alloc((passo + 1) * h);
  for (let y = 0; y < h; y++) {
    cru[y * (passo + 1)] = 0; // filtro NENHUM
    px.copy(cru, y * (passo + 1) + 1, y * passo, (y + 1) * passo);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    ASSINATURA,
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(cru, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/* ===================== EMPACOTAR ===================== */

/**
 * Arruma os quadros em FILEIRAS de altura variável (shelf packing), ordenados por altura decrescente.
 *
 * Escolhi a mais simples que serve, e o motivo é a medição: são ~39 quadros entre 24×29 e 34×36 — quase do
 * mesmo tamanho. Empacotadores melhores (MaxRects, Skyline) ganham quando os retângulos variam muito; aqui
 * ganhariam quase nada e custariam código que erra em silêncio. Se um dia entrar arte de tamanhos díspares,
 * a assinatura não muda: só o miolo desta função.
 *
 * `margem` de 1px entre quadros é o que impede o SANGRAMENTO — a interpolação da GPU puxa o texel vizinho na
 * borda, e sem folga o pé de um sprite aparece no topo do outro. Com `SCALE_MODES.NEAREST` o risco é menor,
 * mas não é nulo em escala fracionária, e 1px por quadro custa ~2 KB no atlas inteiro.
 */
export function empacotar(quadros, { largura = 512, margem = 1 } = {}) {
  const ordenados = [...quadros].sort((a, b) => b.h - a.h || b.w - a.w);
  const postos = [];
  let x = margem, y = margem, alturaFileira = 0;
  for (const q of ordenados) {
    if (x + q.w + margem > largura) { x = margem; y += alturaFileira + margem; alturaFileira = 0; }
    postos.push({ ...q, x, y });
    x += q.w + margem;
    if (q.h > alturaFileira) alturaFileira = q.h;
  }
  return { largura, altura: y + alturaFileira + margem, postos };
}

/** Desenha os quadros posicionados num buffer RGBA do tamanho do atlas. Cópia pura: nada de mistura. */
export function compor(largura, altura, postos) {
  const px = Buffer.alloc(largura * altura * 4); // transparente
  for (const q of postos) {
    for (let ly = 0; ly < q.h; ly++) {
      const origem = ly * q.w * 4;
      const destino = ((q.y + ly) * largura + q.x) * 4;
      q.px.copy(px, destino, origem, origem + q.w * 4);
    }
  }
  return px;
}

/**
 * O manifesto: `nome → {x, y, w, h}`. É o que o runtime lê para recortar o atlas, e é DADO PURO — nenhum
 * caminho de arquivo, nenhuma URL. Quem carrega decide onde o atlas mora.
 */
export function manifesto(postos) {
  const out = {};
  for (const q of postos) out[q.nome] = { x: q.x, y: q.y, w: q.w, h: q.h };
  return out;
}

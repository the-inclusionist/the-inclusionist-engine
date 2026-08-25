// SPDX-License-Identifier: GPL-3.0-or-later
// tools/png-write.mjs — ESCREVE um PNG a partir de pixels, sem dependência nenhuma.
//
// Ferramenta de AUTORIA, não do jogo: vive em `tools/`, não em `app/`, e nada do pacote a importa. Existe
// porque a arte de fundo dos cenários pode passar a ser gerada por código, e gerar arte exige um codificador
// tanto quanto conferi-la exigiu um decodificador (ver tests/city-tiles).
//
// O formato, na parte que importa: assinatura + IHDR + IDAT (zlib do próprio node) + IEND, cada bloco com um
// CRC-32. As linhas vão com filtro 0 (nenhum) — perde-se compressão e ganha-se um arquivo que qualquer um
// consegue reler de cabeça, o que para arte de referência vale mais que bytes.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const cabeca = Buffer.alloc(8);
  cabeca.writeUInt32BE(dados.length, 0);
  cabeca.write(tipo, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, 'ascii'), dados])), 0);
  return Buffer.concat([cabeca, dados, crc]);
}

/**
 * `pixels` é uma matriz [altura][largura] de `[r,g,b,a]` (a opcional, 255). Devolve o Buffer do PNG.
 * RGBA de 8 bits sempre: um formato só, sem palheta nem escolha, porque quem gera arte aqui não quer decidir
 * codificação a cada chamada — quer olhar o desenho.
 */
export function encodePng(pixels) {
  const h = pixels.length, w = pixels[0].length;
  const raw = Buffer.alloc(h * (1 + w * 4));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filtro 0: linha crua
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = pixels[y][x];
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // deflate, filtro padrão, sem entrelaçamento
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(raw, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/** Grava direto. `pixels` como acima. */
export function writePng(caminho, pixels) {
  writeFileSync(caminho, encodePng(pixels));
}

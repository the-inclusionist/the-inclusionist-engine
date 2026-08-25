// SPDX-License-Identifier: AGPL-3.0-or-later
// tools/png-write — o codificador de PNG da AUTORIA (project node).
//
// Ele não embarca: vive em `tools/` e nada do jogo o importa. Tem teste mesmo assim, e por um motivo
// específico: é com ele que a arte de fundo dos cenários pode passar a ser gerada, e um codificador com um
// erro de passo de linha produz arquivos que ABREM, parecem quase certos, e estão errados de um pixel por
// linha. Esse é o tipo de defeito que a vista não pega e o disco guarda para sempre.
//
// A prova é de IDA E VOLTA contra o mesmo decodificador que tests/city-tiles usa: se os dois estivessem
// errados do mesmo jeito, o round-trip fecharia mentindo — por isso os casos abaixo também conferem o
// CABEÇALHO byte a byte contra o que a especificação manda, que é uma fonte independente dos dois.
import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { encodePng } from '../tools/png-write.mjs';

/** Decodifica RGBA de 8 bits sem filtro-por-linha diferente de 0 (é o que o nosso codificador emite). */
function decodar(buf) {
  let off = 8, w = 0, h = 0, ct = 0, bits = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tipo = buf.toString('ascii', off + 4, off + 8);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (tipo === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bits = d[8]; ct = d[9]; }
    else if (tipo === 'IDAT') idat.push(d);
    else if (tipo === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rb = w * 4, px = [];
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filtro = raw[pos++];
    const linha = [];
    for (let x = 0; x < w; x++) {
      const i = pos + x * 4;
      linha.push([raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]);
    }
    px.push(linha);
    pos += rb;
    if (filtro !== 0) throw new Error('filtro inesperado: ' + filtro);
  }
  return { w, h, ct, bits, px };
}

/** Matriz de teste com dimensões ÍMPARES: um erro de passo de linha só aparece quando w não é bonito. */
function matriz(W, H) {
  const m = [];
  for (let y = 0; y < H; y++) {
    const l = [];
    for (let x = 0; x < W; x++) l.push([(x * 7) % 256, (y * 11) % 256, (x * y) % 256, 255]);
    m.push(l);
  }
  return m;
}

describe('tools/png-write', () => {
  it('[Right] ida e volta: cada pixel volta idêntico, em dimensões ímpares', () => {
    const alvo = matriz(37, 23);
    const lido = decodar(encodePng(alvo));
    expect([lido.w, lido.h]).toEqual([37, 23]);
    let iguais = 0;
    for (let y = 0; y < 23; y++) for (let x = 0; x < 37; x++) {
      if (lido.px[y][x].join() === alvo[y][x].join()) iguais++;
    }
    expect(iguais).toBe(37 * 23);
  });

  it('[Interface] o cabeçalho é o que a especificação manda — 8 bits, RGBA, sem entrelaçamento', () => {
    // Conferido contra a spec, e não contra o nosso decodificador: se os dois tivessem o mesmo erro, o
    // round-trip acima fecharia mentindo. Aqui a fonte é independente.
    const b = encodePng(matriz(4, 4));
    expect([...b.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(b.toString('ascii', 12, 16)).toBe('IHDR');
    expect(b[24]).toBe(8);  // bits por canal
    expect(b[25]).toBe(6);  // tipo de cor: RGBA
    expect(b[28]).toBe(0);  // entrelaçamento: nenhum
  });

  it('[Boundary] o alfa atravessa — arte de camada depende de transparência', () => {
    // As camadas de parallax se sobrepõem: uma camada opaca por engano apaga as de trás, e o sintoma é "o
    // fundo sumiu", que ninguém liga a um canal de alfa perdido no codificador.
    const alvo = [[[10, 20, 30, 0], [40, 50, 60, 128]]];
    const lido = decodar(encodePng(alvo));
    expect(lido.px[0][0]).toEqual([10, 20, 30, 0]);
    expect(lido.px[0][1]).toEqual([40, 50, 60, 128]);
  });

  it('[Zero] uma imagem de 1×1 é um PNG válido', () => {
    const lido = decodar(encodePng([[[1, 2, 3, 255]]]));
    expect([lido.w, lido.h, lido.px[0][0]]).toEqual([1, 1, [1, 2, 3, 255]]);
  });

  it('[Interface] o alfa PADRÃO é opaco — quem não disser nada não fica invisível', () => {
    const lido = decodar(encodePng([[[9, 9, 9]]]));
    expect(lido.px[0][0][3]).toBe(255);
  });
});

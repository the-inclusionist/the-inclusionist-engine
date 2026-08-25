// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de scripts/atlas — o empacotador de sprites (item 22, X2). Project node: só lê arquivos e bytes.
//
// ========================= POR QUE ESTE ARQUIVO EXISTE ANTES DO PLUGIN =========================
// Um codificador de PNG errado NÃO ESTOURA. Ele grava um arquivo que abre, que o navegador desenha, e que
// mostra a arte deslocada em um pixel, ou com o canal alfa trocado, ou com a última linha repetida. Num jogo
// cuja arte é a interface de uma criança de baixa visão, esse é exatamente o defeito que ninguém confere
// olhando — e que passaria por build, por teste de fumaça e por captura de tela.
//
// Por isso os casos centrais aqui são de IDA E VOLTA: codifica, decodifica, e compara BYTE A BYTE. E o mais
// importante roda sobre a ARTE DE VERDADE do jogo, não sobre um quadrado inventado: um empacotador que
// funciona com um fixture de 4×4 e falha nos 39 quadros reais não serve para nada.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodificarPng, codificarPng, empacotar, compor, manifesto } from '../scripts/atlas.mjs';

const SPRITES = join(process.cwd(), 'app', 'public', 'assets', 'sprites', 'menino');

/** Os quadros de COR de verdade (sem as variantes `_hc`, que nada carrega — issue #71). */
function quadrosReais() {
  const out = [];
  for (const anim of readdirSync(SPRITES)) {
    const dir = join(SPRITES, anim);
    // `_LEIA-ME.md` mora ao lado das pastas de animação — filtrar por "é diretório" e não por nome.
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.png') || f.endsWith('_hc.png')) continue;
      const { w, h, px } = decodificarPng(readFileSync(join(dir, f)));
      out.push({ nome: `${anim}/${f.replace('.png', '')}`, w, h, px });
    }
  }
  return out;
}

/** Um quadro sintético com um padrão que denuncia deslocamento: cada pixel carrega as próprias coordenadas. */
function quadroTeste(nome, w, h) {
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      px[i] = x * 7 % 256; px[i + 1] = y * 11 % 256; px[i + 2] = (x + y) % 256; px[i + 3] = 255 - (x % 3);
    }
  }
  return { nome, w, h, px };
}

describe('PNG: ida e volta', () => {
  it('[Right] codificar → decodificar devolve os MESMOS bytes', () => {
    const q = quadroTeste('t', 13, 7);
    const volta = decodificarPng(codificarPng(q.w, q.h, q.px));
    expect([volta.w, volta.h]).toEqual([13, 7]);
    expect(Buffer.compare(volta.px, q.px)).toBe(0);
  });

  it('[Boundary] 1×1 sobrevive à volta — o menor PNG possível', () => {
    const px = Buffer.from([9, 8, 7, 6]);
    const volta = decodificarPng(codificarPng(1, 1, px));
    expect(Buffer.compare(volta.px, px)).toBe(0);
  });

  it('[Right] o ALFA atravessa: um quadro totalmente transparente volta transparente', () => {
    // O canal que mais erra em silêncio: um PNG opaco por engano parece "quase certo" na tela e destrói o
    // recorte do sprite. E é o canal que o jogo mais usa — todo quadro tem fundo transparente.
    const px = Buffer.alloc(4 * 4 * 4); // tudo zero = transparente
    const volta = decodificarPng(codificarPng(4, 4, px));
    expect([...volta.px].every((b) => b === 0)).toBe(true);
  });

  it('[Error] recusa o que não entende, em vez de adivinhar', () => {
    expect(() => decodificarPng(Buffer.from('nao é png'))).toThrow(/não é PNG/);
  });
});

describe('empacotar: a arrumação', () => {
  it('[Right] nenhum quadro sai da largura declarada', () => {
    const qs = [quadroTeste('a', 40, 10), quadroTeste('b', 40, 10), quadroTeste('c', 40, 10)];
    const { largura, postos } = empacotar(qs, { largura: 100 });
    for (const p of postos) expect(p.x + p.w).toBeLessThanOrEqual(largura);
  });

  it('[Right] nenhum par de quadros se SOBREPÕE — nem encostado', () => {
    // A falha que este caso pega é a que estraga a arte sem estourar: dois sprites sobrepostos no atlas
    // mostram um pedaço do vizinho dentro do recorte do outro.
    const qs = Array.from({ length: 20 }, (_, i) => quadroTeste('q' + i, 8 + (i % 5) * 4, 6 + (i % 7) * 3));
    const { postos } = empacotar(qs, { largura: 64 });
    for (let i = 0; i < postos.length; i++) {
      for (let j = i + 1; j < postos.length; j++) {
        const a = postos[i], b = postos[j];
        const separados = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(separados, `${a.nome} e ${b.nome} se sobrepõem`).toBe(true);
      }
    }
  });

  it('[Interface] a MARGEM existe: quadros vizinhos não ficam colados', () => {
    // Sem folga, a interpolação da GPU puxa o texel vizinho na borda e o pé de um sprite aparece no topo do
    // outro. É sutil, é intermitente, e some quando se vai procurar.
    const qs = [quadroTeste('a', 10, 10), quadroTeste('b', 10, 10)];
    const [a, b] = empacotar(qs, { largura: 64, margem: 1 }).postos;
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(a.w + 1);

    // E O PADRÃO TAMBÉM, que é o que quase escapou: este caso passava `margem: 1` explícito, então zerar o
    // valor PADRÃO deixava a suíte verde — e o build real, que não passa opção nenhuma, sairia sem folga.
    // Achado por mutação. Um teste que só exercita o caminho parametrizado não protege o caminho usado.
    const [p, q] = empacotar(qs, { largura: 64 }).postos;
    expect(Math.abs(p.x - q.x), 'a margem PADRÃO sumiu').toBeGreaterThanOrEqual(p.w + 1);
    expect(p.x, 'a borda esquerda do atlas também tem folga').toBeGreaterThan(0);
  });

  it('[Zero] lista vazia não quebra e não inventa atlas', () => {
    const { postos, altura } = empacotar([], { largura: 64 });
    expect(postos).toEqual([]);
    expect(altura).toBeGreaterThan(0); // só as margens
  });
});

describe('compor + manifesto: o recorte tem de bater', () => {
  it('[Right] cada quadro reaparece INTACTO na posição que o manifesto declara', () => {
    // É o caso que liga as três partes. Se o manifesto e a composição discordarem em um pixel, o jogo desenha
    // arte deslocada — e "deslocada em 1px" é a definição de defeito que passa por revisão.
    const qs = [quadroTeste('a', 11, 9), quadroTeste('b', 7, 13), quadroTeste('c', 16, 5)];
    const { largura, altura, postos } = empacotar(qs, { largura: 40 });
    const px = compor(largura, altura, postos);
    const mf = manifesto(postos);
    for (const q of qs) {
      const m = mf[q.nome];
      for (let y = 0; y < q.h; y++) {
        for (let x = 0; x < q.w; x++) {
          const noAtlas = ((m.y + y) * largura + (m.x + x)) * 4;
          const noQuadro = (y * q.w + x) * 4;
          expect(px.subarray(noAtlas, noAtlas + 4).equals(q.px.subarray(noQuadro, noQuadro + 4)),
            `${q.nome} em ${x},${y}`).toBe(true);
        }
      }
    }
  });
});

describe('a ARTE DE VERDADE: o teste que decide se isto serve', () => {
  const quadros = quadrosReais();

  it('[Right] os quadros de cor do jogo decodificam — todos', () => {
    // Se um único deles usasse profundidade 16, entrelace ou paleta, o empacotador recusaria e este caso
    // diria QUAL. Melhor descobrir aqui do que num build silencioso.
    expect(quadros.length).toBeGreaterThan(30);
    for (const q of quadros) {
      expect(q.px.length, q.nome).toBe(q.w * q.h * 4);
    }
  });

  it('[Right] empacotados e recompostos, os 39 quadros voltam PIXEL A PIXEL', () => {
    const { largura, altura, postos } = empacotar(quadros, { largura: 256 });
    const atlasPx = compor(largura, altura, postos);
    // e passa pelo PNG de verdade — codifica e decodifica, como o navegador fará
    const volta = decodificarPng(codificarPng(largura, altura, atlasPx));
    const mf = manifesto(postos);
    let conferidos = 0;
    for (const q of quadros) {
      const m = mf[q.nome];
      for (let y = 0; y < q.h; y++) {
        const noAtlas = ((m.y + y) * largura + m.x) * 4;
        const noQuadro = y * q.w * 4;
        expect(volta.px.subarray(noAtlas, noAtlas + q.w * 4)
          .equals(q.px.subarray(noQuadro, noQuadro + q.w * 4)), `${q.nome} linha ${y}`).toBe(true);
      }
      conferidos++;
    }
    expect(conferidos).toBe(quadros.length);
  });

  it('[Interface] o atlas cabe numa textura modesta — o pilar 1 é máquina de escola', () => {
    // 2048 é o piso seguro de `MAX_TEXTURE_SIZE` em GPU antiga; abaixo disso não há hardware que recuse.
    const { largura, altura } = empacotar(quadros, { largura: 256 });
    expect(largura).toBeLessThanOrEqual(2048);
    expect(altura).toBeLessThanOrEqual(2048);
  });

  it('[Many] UMA requisição no lugar de 38 — é o que este item compra', () => {
    // O número que corrige a medida errada do X1: o ganho não é byte, é REQUISIÇÃO. `render/sprites.ts`
    // registra 55 requisições para 38 arquivos no boot, e diz que o custo é latência em rede de escola.
    const { postos } = empacotar(quadros, { largura: 256 });
    expect(postos.length).toBe(quadros.length);
    expect(new Set(postos.map((p) => p.nome)).size).toBe(quadros.length); // nenhum nome repetido no manifesto
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// A DOCUMENTAÇÃO DE ARTE CONTRA A ARTE (item 15 da pipeline, project node: só lê arquivos).
//
// ========================= POR QUE ISTO EXISTE =========================
// O item 15 nasceu de um defeito de UM tipo só: três documentos declaravam um sprite 16×32 e a arte entregue
// não tinha um único quadro desse tamanho. Consertar as frases resolve o caso; não resolve a CLASSE. E a
// classe cobrou logo: a primeira emenda, escrita no mesmo dia, corrigiu o 16×32 e errou três das próprias
// contas — 83 PNGs em vez de 80, 14 animações em vez de 13, 14 tamanhos em vez de 15.
//
// Uma contagem escrita à mão envelhece na primeira arte nova, e o modo de envelhecer é silencioso: ninguém
// relê o Art-Bible ao acrescentar um quadro. Este arquivo LÊ OS CABEÇALHOS DOS PNG e compara com os números
// que o documento afirma. Quando a arte mudar, quem falha é o documento — que é exatamente quem tem de falhar.
//
// O QUE ELE NÃO FAZ: não diz qual número é o certo. Ele diz que os dois discordam, e o conserto é sempre o
// mesmo — remedir e reescrever a frase. Prender o número no teste em vez de no documento inverteria o
// problema: o documento continuaria podendo mentir, e o teste seria a segunda cópia da mentira.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ_APP = join(process.cwd(), 'app');
const BIBLIA = readFileSync(join(process.cwd(), 'docs', 'game-design', 'Art-Bible.md'), 'utf8');

/** Todos os .png sob `app/`, recursivo. */
function pngs(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...pngs(p));
    else if (nome.endsWith('.png')) out.push(p);
  }
  return out;
}

/** Largura e altura do PNG, lidas do IHDR: 8 bytes de assinatura + 4 de tamanho + 4 de tipo, depois w e h. */
function tamanho(p) {
  const b = readFileSync(p);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const TODOS = pngs(RAIZ_APP);
const SPRITES = TODOS.filter((p) => p.includes('sprites'));
const COR = SPRITES.filter((p) => !p.endsWith('_hc.png'));
const ANIMS = new Set(SPRITES.map((p) => p.split(/[\\/]/).slice(-2)[0]));
const TAMANHOS = new Set(SPRITES.map((p) => tamanho(p).join('x')));

/** Só os quadros de personagem de verdade: o 64×64 é sobra declarada, e o documento a trata à parte. */
const SEM_SOBRA = SPRITES.map(tamanho).filter(([w, h]) => !(w === 64 && h === 64));

/** Extrai o número que o Art-Bible afirma num trecho. Falha ALTO se a frase mudou de forma. */
function afirmado(re, oQue) {
  const m = BIBLIA.match(re);
  expect(m, `o Art-Bible não diz mais ${oQue} na forma esperada — reescreveu a frase? ajuste o caso`).toBeTruthy();
  return Number(m[1]);
}

describe('o Art-Bible conta a arte que existe', () => {
  it('[Right] o total de PNGs bate', () => {
    expect(afirmado(/\*\*(\d+) PNGs\*\*/, 'o total de PNGs')).toBe(TODOS.length);
  });

  it('[Right] o número de quadros de sprite bate', () => {
    expect(afirmado(/(\d+) sprite frames cover/, 'quantos quadros de sprite')).toBe(SPRITES.length);
  });

  it('[Right] o número de animações bate', () => {
    expect(afirmado(/\*\*(\d+) animations\*\*/, 'quantas animações')).toBe(ANIMS.size);
  });

  it('[Right] o número de TAMANHOS DISTINTOS bate — é a conta que o 16×32 errava', () => {
    expect(afirmado(/\*\*(\d+) distinct sizes\*\*/, 'quantos tamanhos distintos')).toBe(TAMANHOS.size);
  });

  // Este caso mudou de assunto quando a issue #71 fechou, e ficou MAIS FORTE. Ele afirmava "só 39 dos 77 são
  // desenhados" — uma contagem. Agora afirma que os dois números são o MESMO: nenhum PNG embarca sem que o
  // jogo o desenhe.
  //
  // A diferença importa porque a versão antiga não pegaria a volta do defeito: um `_hc` novo faria o total ir
  // a 40 enquanto `COR` ficava em 39, e a frase "só 39 dos 40" continuaria batendo com `COR.length`. O que
  // pega é comparar os dois conjuntos, não conferir um número contra o documento.
  //
  // É o "caso irmão" que a própria #71 pediu ao ser aberta: todo PNG em `sprites/` tem de ser arte viva.
  //
  // MUTAÇÃO CONFERIDA: recriando um `andar/0_hc.png` (cópia do `0.png`), este caso falha em
  // "arte que embarca e ninguém desenha: andar/0_hc.png".
  it('[Right] NENHUM quadro embarca sem ser desenhado — a arte morta não volta em silêncio', () => {
    const mortos = SPRITES.filter((p) => !COR.includes(p)).map((p) => p.split(/[\/]/).slice(-2).join('/'));
    expect(mortos, 'arte que embarca e ninguém desenha: ' + mortos.join(', ')).toEqual([]);
    expect(afirmado(/All (\d+) are frames the game draws/, 'quantos quadros são desenhados')).toBe(COR.length);
  });

  it('[Boundary] a FAIXA de larguras e alturas bate, ignorando a sobra 64×64', () => {
    const larg = SEM_SOBRA.map(([w]) => w), alt = SEM_SOBRA.map(([, h]) => h);
    const faixa = BIBLIA.match(/widths (\d+)[–-](\d+) px, heights (\d+)[–-](\d+) px/);
    expect(faixa, 'a frase da faixa mudou de forma').toBeTruthy();
    expect([Number(faixa[1]), Number(faixa[2])]).toEqual([Math.min(...larg), Math.max(...larg)]);
    expect([Number(faixa[3]), Number(faixa[4])]).toEqual([Math.min(...alt), Math.max(...alt)]);
  });

  it('[Interface] nenhum quadro é 16×32 — a afirmação que originou o item 15', () => {
    // Se um dia um sprite 16×32 existir, este caso reprova e a frase "not one is 16×32" tem de sair. É o
    // único caso daqui que protege uma frase em vez de um número, e é a frase que o item inteiro corrigiu.
    expect(BIBLIA).toMatch(/not one is 16×32/);
    expect(SPRITES.map(tamanho).filter(([w, h]) => w === 16 && h === 32)).toEqual([]);
  });

  it('[Right] o tamanho VARIA dentro da mesma animação — e o documento diz isso, com exemplos que conferem', () => {
    // A consequência mais forte da medição, e a que amarra o atlas: não há nem tamanho por animação. Cada
    // exemplo citado no documento é conferido contra o arquivo, para o texto não guardar um par que já mudou.
    const porAnim = new Map();
    for (const p of COR) {
      const a = p.split(/[\\/]/).slice(-2)[0];
      if (!porAnim.has(a)) porAnim.set(a, new Set());
      porAnim.get(a).add(tamanho(p).join('×'));
    }
    const variam = [...porAnim].filter(([, v]) => v.size > 1);
    expect(variam.length, 'nenhuma animação varia mais — apague a afirmação do Art-Bible').toBeGreaterThan(0);

    const citados = [...BIBLIA.matchAll(/`([a-z-]+)` is (\d+×\d+) and (\d+×\d+)/g)];
    expect(citados.length, 'o Art-Bible deixou de citar exemplos — sem eles este caso não confere nada')
      .toBeGreaterThan(0);
    for (const m of citados) {
      const [, anim, a1, a2] = m;
      const reais = porAnim.get(anim);
      expect(reais, `o Art-Bible cita \`${anim}\`, que não existe em sprites/`).toBeTruthy();
      expect([...reais].sort(), `os tamanhos citados para \`${anim}\` não são os do arquivo`)
        .toEqual([a1, a2].sort());
    }
  });
});

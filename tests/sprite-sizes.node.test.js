// SPDX-License-Identifier: GPL-3.0-or-later
// OS TAMANHOS DE SPRITE, medidos (project node: lê o cabeçalho dos PNG, sem biblioteca).
//
// Existe porque três documentos afirmavam um **sprite 16×32** e a arte entregue não tem um único arquivo
// desse tamanho. Uma spec falsa é pior que spec nenhuma: ela faz o próximo trabalho ser planejado contra um
// mundo que não existe — um atlas de grade uniforme, um pivô derivado de altura fixa.
//
// Emendar os documentos conserta o passado. Este teste é o que impede a divergência de voltar: se um dia a
// arte for normalizada num tamanho só, ELE FALHA, e quem normalizou tem de atualizar os documentos no mesmo
// passo. O acoplamento é de propósito e está na direção certa — a medida manda no texto, nunca o contrário.
//
// Lê o IHDR direto: bytes 16..24 do PNG são largura e altura em big-endian. Sem dependência nova para uma
// pergunta de duas linhas.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SPRITES = join(process.cwd(), 'app', 'public', 'assets', 'sprites');

function dims(p) {
  const b = readFileSync(p);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null; // não é PNG
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(24 - 4) };
}

/** Todos os PNG sob app/public/assets/sprites, com pasta e dimensões. */
function todos(dir = SPRITES, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) todos(p, acc);
    else if (nome.toLowerCase().endsWith('.png')) {
      const d = dims(p);
      if (d) acc.push({ nome, dir: dir.slice(SPRITES.length + 1).replace(/\\/g, '/'), ...d });
    }
  }
  return acc;
}

const PNGS = todos();

/** O 64×64 solto em `teto/` chama-se "candidato": é sobra de estudo, não decisão de tamanho. */
const CANDIDATO = '3-noroeste-candidato.png';
const QUADROS = PNGS.filter((p) => p.nome !== CANDIDATO);

describe('tamanhos de sprite — a arte manda no texto', () => {
  it('[Zero] o teste está olhando arquivos de verdade', () => {
    // Sem isto, mudar a pasta de lugar deixaria todos os casos abaixo verdes por não medirem nada.
    expect(PNGS.length).toBeGreaterThan(50);
  });

  it('[Right] NENHUM quadro é 16×32 — era o que três documentos afirmavam', () => {
    const iguais = QUADROS.filter((p) => p.w === 16 && p.h === 32).map((p) => `${p.dir}/${p.nome}`);
    expect(iguais, 'apareceu um 16×32: a spec antiga voltou, ou a arte mudou e os docs precisam saber').toEqual([]);
  });

  it('[Right] NÃO há tamanho fixo: mais de dez tamanhos distintos convivem', () => {
    // A decisão do Dev (ADR-0027, machine-spec.sprite-size) é que não há tamanho fixo. Se um dia isto cair
    // para 1, alguém normalizou a arte — e aí Art-Bible.md e character-animation.md estão errados de novo,
    // só que na direção oposta.
    const distintos = new Set(QUADROS.map((p) => `${p.w}x${p.h}`));
    expect(distintos.size).toBeGreaterThan(10);
  });

  it('[Boundary] a ALTURA varia entre estados — é o que proíbe pivô derivado de altura fixa', () => {
    // `render/draw` ancora o squash & stretch NOS PÉS. Com alturas diferentes por estado, um pivô calculado
    // a partir de uma altura fixa faria o personagem afundar ou flutuar ao trocar de animação. Este caso é a
    // razão de "cada sprite carrega o próprio pivô" ser requisito, e não preferência.
    const alturas = [...new Set(QUADROS.map((p) => p.h))].sort((a, b) => a - b);
    expect(alturas.length).toBeGreaterThan(1);
    expect(alturas[alturas.length - 1] - alturas[0]).toBeGreaterThanOrEqual(5);
  });

  it('[Boundary] as dimensões ficam na faixa medida (24–34 × 29–36), fora o candidato solto', () => {
    const fora = QUADROS.filter((p) => p.w < 24 || p.w > 34 || p.h < 29 || p.h > 36)
      .map((p) => `${p.dir}/${p.nome} ${p.w}x${p.h}`);
    expect(fora, 'quadro fora da faixa: amplie a faixa aqui E nos documentos, no mesmo passo').toEqual([]);
  });

  it('[Interface] o 64×64 de `teto/` continua sendo a ÚNICA exceção, e continua se chamando candidato', () => {
    // Não foi apagado porque apagar arte versionada é decisão do Dev. Fica nomeado para não virar precedente
    // silencioso: um arquivo fora do padrão que ninguém explica vira, com o tempo, o padrão.
    const soltos = PNGS.filter((p) => p.w === 64 && p.h === 64).map((p) => p.nome);
    expect(soltos).toEqual([CANDIDATO]);
  });
});

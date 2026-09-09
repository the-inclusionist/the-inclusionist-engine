// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUMA DECLINAÇÃO PODE ESTAR MORTA — o inventário dos campos de `Declinios` que ninguém lê.
//
// ========================= A DISTINÇÃO QUE ESTE PROJETO DIZ FAZER =========================
// O `create-game` repete a frase em três sítios: «declinar é escolha; não ter é omissão». Ela é o coração do
// ADR-0106 §2 e já pagou quatro consertos — a barra de a11y (`44a7ba3`), o ator da pausa, o cartão de pausa e
// a voz neural (`7212479`). Mas ela só é verdade enquanto **declinar mudar alguma coisa**.
//
// 🔴 E EM 2026-09-08 UM CAMPO ESTAVA MORTO. `declines.semAssistenteDePad` existe no tipo desde o achado 10 do
// segundo consumidor, o `consumer-quiz` declara-o, o retrato de FORMA regista-o e um caso afirma que ele
// atravessa a raiz intacto — e **código nenhum o lê**. Declarar a ausência e não a declarar davam exactamente
// o mesmo resultado.
//
// ⚠️ E O CASO QUE EXISTIA ERA O DEFEITO ESCRITO COMO GARANTIA, a segunda vez que este repositório encontra
// essa forma (a primeira foi o `quit` montado no `001b185`). «Declinar fica NO REGISTRO — um consumidor pode
// ser auditado pelo que recusou» é uma afirmação legítima *sobre o registo*, e por ser a ÚNICA afirmação
// sobre este campo, fazia um campo inerte parecer vivo.
//
// ========================= POR QUE UM INVENTÁRIO E NÃO UMA PROIBIÇÃO =========================
// A saída óbvia — «acuse em `problems` quem não declina» — foi MEDIDA E RECUSADA: o consumidor não tem como
// consertar isto. O assistente vive em `input/gamepad` e esta raiz não o monta, e não o monta por duas razões
// reais: ele precisa do `spriteBase` do CARTUCHO, e o `padWizDemo` carrega um `ReferenceError` herdado do
// `game.js` (o identificador `SPR` nunca é declarado) que dispara **ao abrir**. Pôr em `problems` uma linha
// que quem a lê não pode resolver é a mesma coisa que um gate sem saída: desliga-se.
//
// Então o que se afirma é o INVENTÁRIO — cada campo morto tem de trazer a razão escrita à mão —, e ele
// ENCOLHE: no dia em que a raiz montar o assistente, a entrada sai daqui, e o caso da saída obriga-a a sair.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_JS = fileURLToPath(new URL('../app/js/', import.meta.url));
const CREATE_GAME = 'boot/create-game.ts';

/**
 * OS CAMPOS DE `Declinios` QUE A ENGINE NÃO LÊ, e por que cada um continua no tipo.
 *
 * ⚠️ A LISTA TEM DE ENCOLHER. Uma entrada nova sem razão escrita à mão é uma declinação que não declina nada,
 * e um consumidor a pensar que decidiu.
 */
const SEM_LEITOR = {
  semAssistenteDePad:
    'o assistente vive em `input/gamepad` e esta raiz não o monta: ele pede o `spriteBase` do cartucho e o ' +
    '`padWizDemo` tem um ReferenceError herdado do `game.js` (`SPR` nunca declarado) que dispara ao abrir. ' +
    'Sai daqui quando a raiz montar o assistente — e é aí que declinar passa a mudar alguma coisa',
};

const fonte = (rel) => readFileSync(join(RAIZ_JS, rel), 'utf8');

/** O bloco `interface Declinios { … }`, que é onde os campos são DECLARADOS e não lidos. */
function blocoDosDeclinios(src) {
  const i = src.indexOf('export interface Declinios {');
  if (i === -1) return null;
  const fim = src.indexOf('\n}', i);
  return fim === -1 ? null : src.slice(i, fim + 2);
}

/** Os nomes dos campos, do próprio bloco — nunca uma cópia à mão ao lado de uma união. */
function camposDeclarados(bloco) {
  return [...bloco.matchAll(/readonly\s+(\w+)\??\s*:/g)].map((m) => m[1]);
}

/** Todo `.ts` da engine, menos o consumidor de exemplo — o quiz DECLARA, não lê. */
function ficheirosDaEngine(dir = RAIZ_JS, prefixo = '') {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    if (prefixo === '' && nome === 'consumer-quiz') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...ficheirosDaEngine(caminho, `${prefixo}${nome}/`)); continue; }
    if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(`${prefixo}${nome}`);
  }
  return saida;
}

const SRC_CG = fonte(CREATE_GAME);
const BLOCO = blocoDosDeclinios(SRC_CG);
const CAMPOS = BLOCO ? camposDeclarados(BLOCO) : [];

/**
 * Quantas vezes a engine MENCIONA o campo fora da declaração.
 *
 * ⚠️ A CONTAGEM É GENEROSA DE PROPÓSITO — o nome em qualquer sítio conta, incluindo dentro de um comentário
 * ou de uma desestruturação. Um crivo apertado aqui acusaria um campo VIVO lido por
 * `const { semX } = declines`, e uma acusação falsa desliga o gate antes de ele apanhar a verdadeira. Falhar
 * para o lado de «vivo» é a direcção certa deste erro.
 */
function leitores(campo) {
  let n = 0;
  for (const f of ficheirosDaEngine()) {
    const src = f === CREATE_GAME ? SRC_CG.split(BLOCO).join('') : fonte(f);
    n += src.split(campo).length - 1;
  }
  return n;
}

describe('nenhuma declinação está morta · o inventário encolhe', () => {
  it('[Vácuo] o bloco `Declinios` foi mesmo encontrado, e tem campos', () => {
    expect(BLOCO, 'a interface mudou de nome ou de forma e o crivo ficou cego').not.toBeNull();
    expect(CAMPOS.length).toBeGreaterThanOrEqual(4);
    expect(CAMPOS).toContain('semMenuDePausa');
  });

  it('[Feliz] todo campo sem leitor está declarado, com a razão escrita à mão', () => {
    const mortos = CAMPOS.filter((c) => leitores(c) === 0);
    const novos = mortos.filter((c) => !(c in SEM_LEITOR));
    expect(novos, `declinação que não declina nada e ninguém declarou: ${novos.join(', ')}`).toEqual([]);
  });

  // ⚠️ A SAÍDA. Sem ela a lista vira monumento: um campo já ligado continuaria a dizer que está morto, e a
  // próxima pessoa leria o inventário como história em vez de estado.
  it('[Fronteira] campo da lista que ganhou leitor sai daqui', () => {
    const ressuscitados = Object.keys(SEM_LEITOR).filter((c) => leitores(c) > 0);
    expect(ressuscitados, `já é lido pela engine; apague a entrada: ${ressuscitados.join(', ')}`).toEqual([]);
  });

  // 📌 O PAR QUE PROVA QUE O DETECTOR MEDE ALGUMA COISA: os outros três SÃO lidos, e o crivo tem de os ver
  // vivos. Sem este caso, um detector que devolvesse sempre zero passaria o [Feliz] enquanto a lista o
  // cobrisse — e passaria a acusar tudo em silêncio.
  it('[Fronteira] os três que a engine lê aparecem como vivos', () => {
    for (const vivo of ['semMenuDePausa', 'semAtorDePausa', 'semVozNeural']) {
      expect(CAMPOS, `${vivo} deixou de ser um declínio`).toContain(vivo);
      expect(leitores(vivo), `${vivo} passou a ser letra morta`).toBeGreaterThan(0);
    }
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. tirar `semAssistenteDePad` de `SEM_LEITOR`     → [Feliz] reprova (o campo morto volta a ser silencioso)
// 2. acrescentar `semMenuDePausa` a `SEM_LEITOR`    → [Fronteira] da saída reprova (a lista mentiria)
// 3. `leitores()` a devolver sempre 0               → reprovam o [Feliz] **e** o [Fronteira] dos vivos
//    📌 e a segunda metade é a que interessa: o [Feliz] só a apanha porque os outros três campos passam a
//    parecer mortos. Se um dia a lista os cobrisse a todos, ele ficaria verde e o crivo estaria cego — quem
//    o apanharia então é o PAR, e é por isso que ele existe em vez de se confiar na regra.
// 4. `leitores()` a devolver sempre 1               → [Fronteira] da saída reprova
// 5. `blocoDosDeclinios` a devolver `null`          → reprovam o [Vácuo], a saída e o par
//
// 📌 Duas das cinco reprovaram casos que eu não tinha previsto. Fica o medido.

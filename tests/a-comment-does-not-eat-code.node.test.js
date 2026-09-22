// SPDX-License-Identifier: AGPL-3.0-or-later
// O COMENTÁRIO NÃO PODE COMER CÓDIGO — o gate que faltava, escrito depois de um defeito real.
//
// ========================= O QUE ACONTECEU =========================
// Em 2026-08-25 (commit `d889254`), um comentário explicativo foi inserido NO MEIO de uma linha:
//
//   ti.addEventListener('click',(e)=>{ … if(!ib)return; // genérico: é o `dataset` … setPauseActorValue(0); pauseIcons.iconAct(ib.dataset.pi,0);
//
// Um `//` vai até o fim da linha. As duas chamadas depois dele — que eram A AÇÃO do clique — ficaram
// comentadas. Os dez ícones de acessibilidade da tela de título passaram a NÃO FAZER NADA: cegueira,
// narração por voz, Libras, modo TEA, teclas alternadas, alto contraste e mais quatro.
//
// E o pior detalhe é o que sobrou VIVO na linha seguinte: `srSay(ib.getAttribute('aria-label'))`. A criança
// que usa leitor de tela clicava em "Alto contraste" e OUVIA "High contrast: off" — resposta imediata,
// nenhuma ação. Um botão morto que fala é pior que um botão morto calado: ele confirma o que não fez.
//
// Ficou assim por 36 commits. Nada acusou, e nada podia:
//   · o `tsc` não lê comentário — nem com `strict`, nem com `noUnusedLocals`;
//   · o gate de tipos com orçamento não vê o que não é erro de tipo;
//   · nenhum teste cobria o despachante do splash (ele vive na raiz de composição, que não é importável);
//   · `setPauseActorValue`, a função chamada ali, DEIXOU DE EXISTIR num refactor posterior — e nem isso
//     apareceu, porque uma chamada dentro de comentário não é uma chamada.
//
// O sintoma que se via era outro e parecia inofensivo: o bundle encolheu 33 bytes numa mudança "só de tipo"
// (issue #80). Os 33 bytes eram as duas chamadas sumindo do código emitido.
//
// ========================= COMO ESTE GATE DISTINGUE PROSA DE CÓDIGO =========================
// A regra tem de deixar passar comentário legítimo com parênteses e ponto-e-vírgula — a árvore tem quinze
// deles, do tipo "trampolim = CHÃO sólido (para EM CIMA); escada = desce ao chão de baixo".
//
// O que separa os dois é o ESPAÇO: prosa escreve `mixer (dados);`, chamada escreve `iconAct(0);`. Exigir o
// identificador COLADO no parêntese derruba os quinze falsos positivos e mantém o defeito. Medido: 0
// suspeitos na árvore inteira hoje, 1 quando o defeito é reintroduzido.
//
// MUTAÇÃO CONFERIDA: reinserindo o comentário no meio daquela linha do `main.ts`, este caso falha com
// "comentário engoliu chamada — app\\js\\main.ts:1734".
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');

function fontes(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) fontes(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

/** Uma CHAMADA terminada: identificador colado no `(`, e `;` depois do `)`. */
const CHAMADA = /[A-Za-z_$][\w$]*\([^()]*\)\s*;/;

/** Linhas com CÓDIGO antes do `//` cujo comentário contém uma chamada terminada. */
function engolidas(arquivo) {
  const achados = [];
  readFileSync(arquivo, 'utf8').split('\n').forEach((ln, i) => {
    const k = ln.indexOf('//');
    if (k <= 0) return;                        // sem `//`, ou o `//` abre a linha (comentário inteiro)
    const antes = ln.slice(0, k).trim();
    if (!antes) return;                        // só espaço antes: comentário indentado, legítimo
    if (/[,*]$/.test(antes)) return;           // continuação de lista ou bloco `/** … */`
    if (/https?:$/.test(antes)) return;        // uma URL não é um comentário
    if (CHAMADA.test(ln.slice(k + 2))) achados.push(`${arquivo}:${i + 1}`);
  });
  return achados;
}

describe('comentário de fim de linha não engole código', () => {
  it('[Zero] o gate está olhando arquivos de verdade', () => {
    // Sem isto, mudar a pasta de lugar deixaria o caso abaixo verde por não medir nada.
    expect(fontes(RAIZ).length).toBeGreaterThan(60);
  });

  it('[Right] nenhuma linha da árvore tem uma CHAMADA dentro do comentário', () => {
    const todas = fontes(RAIZ).flatMap(engolidas);
    expect(todas, 'comentário engoliu chamada — ' + todas.join(', ')).toEqual([]);
  });

  it('[Interface] a regra deixa PASSAR prosa com parêntese e ponto-e-vírgula', () => {
    // O caso que impede o gate de virar ruído. São quinze linhas assim na árvore, e um gate que reprovasse
    // nelas seria desligado na primeira pressa — e aí não estaria lá no dia em que importa.
    expect(CHAMADA.test('trampolim = CHÃO sólido (para EM CIMA); escada desce')).toBe(false);
    expect(CHAMADA.test('Fase 2: categorias do mixer (dados); audioCat vem de audio.js')).toBe(false);
    expect(CHAMADA.test('TEX_IDLE — respiração (4 quadros); [0] é a pose neutra')).toBe(false);
  });

  it('[Right] e PEGA a forma exata do defeito de 2026-08-25', () => {
    expect(CHAMADA.test(' genérico: é o `dataset` dele que se lê setPauseActorValue(0); pauseIcons.iconAct(x,0);')).toBe(true);
  });
});

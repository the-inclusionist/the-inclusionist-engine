// SPDX-License-Identifier: AGPL-3.0-or-later
// O CONTRASTE DO MENU EM ALTO CONTRASTE — medido, não estimado (issue #83).
//
// ========================= O QUE ESTE ARQUIVO IMPEDE =========================
// Um modo chamado "alto contraste 7:1" que não entrega 7:1 é PIOR que não ter modo nenhum: ele promete um
// número, a professora confia nele, e a criança lê pior do que leria com a promessa ausente. Este arquivo
// existe para que a promessa e a tela não possam divergir em silêncio.
//
// As cores são LIDAS DO `style.css`, não copiadas para cá. Duas fontes que se copiam divergem — é o defeito
// que este repositório já pagou dezesseis vezes com o `DomQuery`. Se alguém mudar um token, a conta muda com
// ele e o caso reprova sozinho.
//
// ========================= O QUE FOI MEDIDO, E POR QUE MUDOU =========================
// Antes da issue #83, no nível 7:1:
//
//   · o VÉU do painel de pausa era `rgba(4,7,15,.72)`, e a razão do texto sobre ele DEPENDIA do jogo por
//     trás — 19,17:1 sobre um quadro preto, 8,07:1 sobre um branco. Com `--ink-soft`, `--accent` e `--good`
//     caía a 5,92 / 5,94 / 5,11:1. AA, não AAA.
//   · o botão SELECIONADO era `#2a3a5e`, e `--good` sobre ele dava 6,70:1.
//
// Nos níveis 3:1 e 4,5:1 nada falhava — e isso está dito aqui de propósito, porque a tentação seria inventar
// uma diferença por nível para o modo "fazer alguma coisa" nos três. O menu já passava; inventar seria teatro.
//
// O conserto não inventou cor: véu OPACO (sai o meio-tom, sai a dependência) e cursor INVERTIDO (fundo
// `--accent`, texto `--accent-ink`). Escurecer o selecionado o aproximaria do não-selecionado e a criança
// PERDERIA O CURSOR — inverter resolve contraste e distinção de uma vez.
//
// MUTAÇÕES CONFERIDAS:
//   · devolvendo `background:rgba(4,7,15,.72)` ao `#dom-layer.hc .screen-pause` → o caso do véu reprova,
//     porque o valor deixa de ser opaco.
//   · trocando `--panel-btn` para `#3a4a6a` (a cor da BORDA do botão) → "ink-soft sobre botão: 6.12:1"
//     reprova. Conferi antes um `#2a3a5e` e ele PASSA (7,77:1) — a mutação óbvia não servia, e registro isso
//     porque uma mutação anotada que não falha é pior que nenhuma: dá a sensação de rigor sem o rigor.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');

/* ===================== a conta da WCAG 1.4.3, escrita aqui e em nenhum outro lugar ===================== */

/** Canal sRGB → linear. É a etapa que separa "clarinho" de LUMINÂNCIA — sem ela a conta erra feio no escuro. */
function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminancia([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
export function razaoDeContraste(a, b) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function hex(s) {
  const h = s.replace('#', '').trim();
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

/** Lê `--nome:#rrggbb` do `:root`. Falha ALTO se o token sumiu — melhor que medir `undefined`. */
function token(nome) {
  const m = CSS.match(new RegExp('--' + nome + ':\\s*(#[0-9a-fA-F]{3,8})'));
  expect(m, `token --${nome} não existe mais no style.css`).toBeTruthy();
  return hex(m[1]);
}

/* ===================== os pares que a criança de fato lê ===================== */

const ALVO_AAA = 7; // o nível mais alto que o modo promete

describe('alto contraste no DOM · o menu entrega o que o modo promete (issue #83)', () => {
  it('[Zero] o gate está lendo o CSS de verdade', () => {
    expect(CSS.length).toBeGreaterThan(5000);
    expect(CSS).toContain('#dom-layer.hc');
  });

  it('[Right] o véu do painel de pausa é OPACO na BASE — 7:1 desde o início, não só no modo', () => {
    // Decisão do Dev, 2026-08-26, e o motivo é de uso: é NO MENU que a pessoa com deficiência ajusta os
    // controles para si. Um contraste que só chega depois de ela achar o ajuste chega tarde. É a mesma razão
    // por que o modo cego já nasce com TTS, earcons, sonar e guarda de beirada ligados.
    //
    // A causa raiz do pior caso era a TRANSLUCIDEZ: um véu translúcido tem a razão que o quadro atrás lhe
    // permitir — 19,17:1 sobre um quadro preto, 8,07:1 sobre um branco. Enquanto for translúcido, nenhum
    // número aqui é garantia; é média de sorte.
    //
    // O CUSTO ESTÁ DECLARADO: não se vê mais o jogo por trás da pausa.
    for (const sel of ['pause-incanvas', 'screen-pause']) {
      const regra = CSS.match(new RegExp('\.' + sel + '\{[^}]*background:([^;}]+)'));
      expect(regra, 'a regra de fundo de .' + sel + ' sumiu').toBeTruthy();
      expect(regra[1], '.' + sel + ' voltou a ser translúcido — a razão volta a depender do jogo').not.toMatch(/rgba|transparent/);
    }
  });

  it('[Right] todo par de texto do menu bate 7:1 em alto contraste', () => {
    const veu = token('bg-solid'), btn = token('panel-btn');
    const ink = token('ink'), inkSoft = token('ink-soft'), accent = token('accent'), accentInk = token('accent-ink');
    const pares = [
      ['ink sobre véu', ink, veu],
      ['ink-soft sobre véu', inkSoft, veu],
      ['accent sobre véu', accent, veu],
      ['ink sobre botão', ink, btn],
      ['ink-soft sobre botão', inkSoft, btn],
      ['cursor invertido (accent-ink sobre accent)', accentInk, accent],
    ];
    const falham = pares
      .map(([nome, fg, bg]) => [nome, razaoDeContraste(fg, bg)])
      .filter(([, r]) => r < ALVO_AAA)
      .map(([nome, r]) => `${nome}: ${r.toFixed(2)}:1`);
    expect(falham, 'par abaixo de 7:1 num modo que promete 7:1: ' + falham.join(' | ')).toEqual([]);
  });

  it('[Right] a PALETA BASE também bate 7:1 — o modo não é pré-requisito para enxergar o menu', () => {
    // O que o Dev corrigiu: o alto contraste é um AJUSTE, não a porta de entrada. Quem precisa dele tem de
    // conseguir LER o menu para encontrá-lo. Se o menu só ficasse legível depois de ligado, a pessoa teria de
    // atravessar o que não enxerga para chegar ao que a faria enxergar.
    const veu = token('bg-solid'), btn = token('panel-btn'), sel = hex('#2a3a5e');
    const ink = token('ink'), inkSoft = token('ink-soft');
    const pares = [
      ['ink sobre véu', ink, veu],
      ['ink-soft sobre véu', inkSoft, veu],
      ['ink sobre botão', ink, btn],
      ['ink-soft sobre botão', inkSoft, btn],
      ['ink sobre selecionado', ink, sel],
    ];
    const falham = pares
      .map(([nome, fg, bg]) => [nome, razaoDeContraste(fg, bg)])
      .filter(([, r]) => r < ALVO_AAA)
      .map(([nome, r]) => nome + ': ' + r.toFixed(2) + ':1');
    expect(falham, 'a paleta BASE do menu não bate 7:1: ' + falham.join(' | ')).toEqual([]);
  });

  it('[Interface] o cursor continua DISTINGUÍVEL do não-selecionado — contraste não pode custar a orientação', () => {
    // O caso que impede o conserto óbvio-e-errado. Escurecer o botão selecionado levanta a razão do texto e
    // some com o cursor: a criança passa a ler bem sem saber onde está. As duas coisas têm de valer juntas.
    const btn = token('panel-btn'), accent = token('accent');
    expect(razaoDeContraste(btn, accent), 'selecionado e não-selecionado ficaram parecidos demais').toBeGreaterThan(3);
  });

  it('[Boundary] a conta é a da WCAG — confere contra valores conhecidos', () => {
    // Sem isto, um erro na fórmula deixaria todos os casos acima verdes medindo a coisa errada. Preto/branco
    // é 21:1 por definição, e cinza médio contra branco é o par canônico dos exemplos da norma.
    expect(razaoDeContraste([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(razaoDeContraste([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    expect(razaoDeContraste([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 1);
  });
});

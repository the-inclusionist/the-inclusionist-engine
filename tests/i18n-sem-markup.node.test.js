// SPDX-License-Identifier: AGPL-3.0-or-later
// TRADUÇÃO NÃO PODE CONTER MARKUP — o único vetor de injeção que a auditoria de 2026-08-26 deixou aberto.
//
// ========================= DE ONDE ISTO VEIO =========================
// A issue #51 rastreava 44 alertas do CodeQL no `game.js`, e um deles era `js/xss-through-dom`, marcado no
// texto original como "rever". O `game.js` não existe mais e o scanner mudou (o GitLab usa Semgrep), então o
// alerta específico é irreproduzível. A revisão foi feita à mão.
//
// ========================= O QUE A AUDITORIA ACHOU, E O QUE NÃO ACHOU =========================
// São 38 pontos de `innerHTML`/`insertAdjacentHTML` na árvore. Nenhum recebe texto de fora — conferido por
// FONTE DE DADO, que é o que importa, e não por ponto:
//
//   · nome de dispositivo de áudio (o usuário renomeia um Bluetooth)  → `textContent`, nunca markup
//   · nome de voz do sistema (`speechSynthesis.getVoices`)            → `textContent`
//   · progresso do assistente de gamepad                              → `textContent`
//   · id do gamepad (um USB forjado declara o nome que quiser)        → só CHAVE de busca (`padLayoutFromId`,
//                                                                       `padMapFor`); nunca interpolado
//   · palavras dos desafios                                           → `game/activity-content`, empacotadas
//   · valores do armazenamento                                        → nenhum chega a markup
//
// O QUE SOBRA, e é o motivo deste arquivo: os textos de i18n vão CRUS para dentro de template literals que
// viram `innerHTML`. Hoje isso é seguro porque os dicionários são nossos e não têm markup — 1.323 entradas
// varridas, zero com tag. Mas "é seguro porque ninguém escreveu markup ainda" não é uma garantia: é um hábito.
// Uma tradução contribuída, colada de um documento, ou gerada por ferramenta pode trazer uma tag, e ela
// executaria dentro do jogo.
//
// ⚠️ ESTE GATE NÃO PROVA "SEM XSS". Ele fecha UM vetor. Duas coisas continuam por conta de quem escreve:
//   · quando a tela da grade de letras existir (ADR-0041), texto DIGITADO passa a alcançar a interface —
//     e aí o alvo tem de ser `textContent`, ou escapado;
//   · qualquer `innerHTML` novo que interpole algo que não seja i18n, número ou chave enumerada.
//
// MUTAÇÃO CONFERIDA: pondo `'x': '<b>oi</b>'` em `app/js/i18n/pt.ts`, o caso falha nomeando `pt.ts  x`.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'app', 'js', 'i18n');

/** `chave: 'valor'` (ou aspas duplas), com escapes respeitados. */
const ENTRADA = /['"]?([\w.$-]+)['"]?\s*:\s*(['"])((?:\\.|(?!\2).)*)\2/g;

/** Abre uma tag: `<` seguido de letra, `/` ou `!`. `1 < 2` e `a<b` não casam. */
const ABRE_TAG = /<[a-zA-Z/!]/;

function entradas() {
  const out = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const m of src.matchAll(ENTRADA)) out.push({ arquivo: f, chave: m[1], valor: m[3] });
  }
  return out;
}

describe('i18n · nenhuma tradução carrega markup', () => {
  it('[Zero] o gate está lendo os dicionários de verdade', () => {
    // Sem isto, renomear a pasta deixaria o caso abaixo verde por não medir nada — e um gate de segurança
    // que passa por estar vazio é pior que nenhum, porque dá a sensação de cobertura.
    const todas = entradas();
    expect(todas.length).toBeGreaterThan(900);
    expect(new Set(todas.map((e) => e.arquivo)).size).toBeGreaterThanOrEqual(3); // pt, en, es
  });

  it('[Right] nenhuma entrada abre uma tag', () => {
    const suspeitas = entradas()
      .filter((e) => ABRE_TAG.test(e.valor))
      .map((e) => `${e.arquivo}  ${e.chave}  ->  ${e.valor.slice(0, 60)}`);
    expect(suspeitas, 'tradução com markup — ela vai CRUA para dentro de innerHTML: ' + suspeitas.join(' | ')).toEqual([]);
  });

  it('[Interface] a regra distingue tag de sinal de menor — senão vira ruído e é desligada', () => {
    expect(ABRE_TAG.test('<b>negrito</b>')).toBe(true);
    expect(ABRE_TAG.test('<img src=x onerror=alert(1)>')).toBe(true);
    expect(ABRE_TAG.test('</div>')).toBe(true);
    expect(ABRE_TAG.test('use 1 < 2 para comparar')).toBe(false);
    expect(ABRE_TAG.test('pressione <- para voltar')).toBe(false);
  });
});

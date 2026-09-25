// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING IN THE ENGINE STORES A CHILD'S PERFORMANCE — the other half of the debt of ADR-0103 §confirmation.
//
// ========================= WHY THIS IS A SIEVE AND NOT A WORD SEARCH =========================
// ADR-0103's claim is an ABSENCE: «nenhum módulo escreve chave de histórico por habilidade». An absence is not proven by
// searching for the word "histórico" — whoever wrote one would not call it that, and a green `grep` would be the
// cheapest way for the gate to lie.
//
// What can be proven is the INVENTORY. Every file of the engine that writes to storage keeps the SAME class of thing:
// the child's preference or this match's state. The sieve freezes that list. A new writing file forces someone to add
// a line here saying WHAT it stores — and that line is where «isto é um histórico de desempenho» would have to be
// written by hand, instead of slipping in unnoticed.
//
// ⚠️ AND THE PROHIBITION'S REASON IS PEDAGOGICAL BEFORE LEGAL, which changes what it forbids: development oscillates, a
// child plays a given activity maybe once a week, and a stored history flattens the oscillation into a trend line that
// reads a normal dip as regression. The LGPD argument would allow storing once data control was sorted out; this one
// never does.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/**
 * Every write to storage, in any of the forms this repository uses.
 * ⚠️ Since ADR-0178 `core/state` and `core/i18n` write through the port the root hands them (`port.set(` in the settings store
 * the root builds, ADR-0232 D4, and in `setLocale`): without that form this sieve went blind to them, and their inventory lines
 * read as orphans.
 * ⚠️ And since ADR-0232 D2b a module keeps the store the root hands it under its own name (`_store?.setJSON(` in `render/crt`,
 * `lqStore?.set(` in `render/lq-filter`, `ctx?.store.setJSON(` in `render/high-contrast`): any `…store`/`…Store` binding, with
 * optional chaining, is a write — the same blindness, one refactor later. And `platform/storage` itself writes through the
 * backend it is GIVEN (`backend.setItem(`), no longer through the global.
 */
const ESCREVE = /(?:^|[^\w.])(?:ctx\??\.)?\w*[sS]tore\??\.(?:set|setBool|setJSON)\s*\(|port\.set\s*\(|(?:localStorage|sessionStorage|backend)\??\.setItem|indexedDB/;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/** Code lines (without line comments) that write to storage. */
function escritasDe(p) {
  return readFileSync(p, 'utf8').split(/\r?\n/)
    .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && ESCREVE.test(ln)).length;
}

/**
 * THE INVENTORY. Key = path from `app/js/`; value = what that file stores.
 *
 * ⚠️ Each entry says WHOSE the stored thing is, because that is the question ADR-0103 asks. Two classes exist, and
 * `platform/storage` explains the boundary: `incl_*` belongs to the CHILD and follows them from game to game (a blind
 * child cannot reconfigure the cane in every game); `incl.<jogo>.*` belongs to THIS match. Neither is a performance
 * history, and that is what this file asserts.
 */
const INVENTARIO = {
  'core/i18n.ts': 'criança · o idioma da interface',
  'core/state.ts': 'criança · modo visual, modo cego, caixa da letra, legendas, índice de menu, cores seguras e por dono, contornos do alto contraste, divisor da bengala, cadeira de rodas, um-botão',
  'input/pad-wizard.ts': 'criança · o mapa de botões deste MODELO de controle, gravado pelo assistente',
  'input/keyboard.ts': 'criança · o esquema de teclas',
  'input/touch.ts': 'criança · mapa de toque, medidas do pad em milímetros, desenho e direção',
  'platform/audio-mixer.ts': 'criança · liga/desliga e volume de cada categoria do mixer',
  'boot/create-game.ts': 'criança/adulto · a simulação de perda auditiva do modo empatia, ligada ou não',
  'platform/tts.ts': 'criança · a voz escolhida para a narração (ADR-0185)',
  'platform/storage.ts': 'the layer itself — the `setItem` of the backend the root lends it lives here, and only here (ADR-0232)',
  'render/crt.ts': 'criança · os parâmetros do filtro CRT',
  'render/high-contrast.ts': 'criança · as cores por papel do alto contraste',
  'render/lq-filter.ts': 'criança · o nível do filtro de baixa qualidade',
  'render/viz-setters.ts': 'criança · a simulação visual escolhida, por jogador',
  'ui/pause-icons.ts': 'criança · o nível do modo TEA',
  // ⚠️ Step 1 of ADR-0106: the four reduced-motion switches of the SCENE are the CHILD's preference, stored under the
  // engine's key.
  'ui/motion-scene.ts': 'criança · os quatro interruptores de movimento reduzido de cena (parallax, decor, itens, partículas)',
  'ui/settings-audio.ts': 'criança · a saída de áudio por jogador',
  // The TTS engine and voice live with the voice section (ADR-0221, issue #203): the child's choice of how they want to
  // hear, not their performance (ADR-0103).
  'ui/voice-settings.ts': 'criança · o motor e a voz de TTS que ela escolheu',
  'ui/settings-motion.ts': 'criança · as reduções de movimento, por jogador',
  'ui/settings-mobility.ts': 'criança · o modo fácil por jogador',
  'ui/vlibras.ts': 'criança · a janela de Libras aberta ou fechada',
};

describe('ADR-0103 · a engine não guarda o desempenho de ninguém', () => {
  const escritores = ficheirosTs()
    .map((p) => [relative(RAIZ, p).split('\\').join('/'), escritasDe(p)])
    .filter(([, n]) => n > 0);

  it('⚠️ [Interface] nenhum ESCRITOR NOVO entrou sem ser declarado', () => {
    const novos = escritores.map(([m]) => m).filter((m) => !(m in INVENTARIO));
    expect(
      novos,
      'módulo novo a escrever em armazenamento. Acrescente-o ao INVENTARIO dizendo DE QUEM é a coisa '
      + 'guardada — e se a resposta for «o desempenho da criança», o ADR-0103 diz que não pode ser guardada.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] o inventário não tem ÓRFÃOS — entrada que nomeia quem já não escreve', () => {
    // Without this case, the inventory rots: an entry could go on describing a file that stopped persisting, and the list
    // would stop being a measurement and become a memory. It is the same hole the public-surface gate had, which cost
    // eighteen green cases over a door that no longer existed.
    const vivos = new Set(escritores.map(([m]) => m));
    const orfaos = Object.keys(INVENTARIO).filter((m) => !vivos.has(m));
    expect(orfaos, 'entrada do inventário a descrever um ficheiro que já não escreve nada').toEqual([]);
  });

  it('⚠️ [Right] a camada de CURRÍCULO não escreve nada — é ela que sabe como a criança vai', () => {
    // The narrowest check and the most important: `educational/` is where the adaptive engine and the bar live, and it
    // is exactly where a per-skill history would come from. No inventory entry is possible here.
    const curriculo = escritores.filter(([m]) => m.startsWith('educational/'));
    expect(curriculo, 'o currículo passou a persistir — é o histórico que o ADR-0103 proíbe').toEqual([]);
  });

  it('[Interface] e ele continua a existir: um inventário vazio provaria por vácuo', () => {
    // If the scan stopped finding anything (a regex that dies, a path that changes), the three cases above would pass for
    // having nothing to examine.
    expect(escritores.length, 'a varredura não achou escritor nenhum — a regex ou o caminho morreram').toBeGreaterThan(10);
    expect(escritores.some(([m]) => m === 'platform/storage.ts')).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ THE REAL THREAT — putting `localStorage.setItem('incl_hist_' + barra.skill, …)` inside
//     `educational/segment-bar` → FOUR fail, two of them here: the NEW writer case and the CURRICULUM-writes-nothing
//     case. The bar's own gate catches it too, by two independent paths.
//   · deleting the `ui/vlibras.ts` line from the INVENTORY → the NEW writer case fails. It is the realistic drift: the
//     list stops covering who writes, and the sieve looks at less than exists.
//   · adding to the INVENTORY an entry for a file that does not exist → the ORPHAN case fails. Without it the list rots:
//     it would describe things that no longer happen, and look bigger than it is. It is the same hole the public-surface
//     gate had, which cost eighteen green cases over a dead door.
//   · killing the `ESCREVE` regex → TWO fail, and the one that matters is the second: without the vacuum case, the three
//     above would pass for having nothing to examine. A sieve that finds nothing proves no absence — it proves the
//     sieve died.

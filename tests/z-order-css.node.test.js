// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE DA ORDEM-Z NO CSS — a metade de OVERLAY do ADR-0020, e a dívida de adoção, com nome.
//
// ========================= O QUE ESTE ARQUIVO GUARDA =========================
// O `core/layers.ts` é a fonte única da ordem-z, e o ADR-0020 diz que ela vale nas DUAS metades do quadro: o
// MUNDO (PIXI `zIndex` na câmera) e o OVERLAY (CSS `z-index` no DOM). A metade do mundo está adotada — o
// bloco "R1" do `main.ts` posiciona ~27 camadas por `Z.*`. A do overlay não: o `style.css` tem quinze
// `z-index` LITERAIS, de 4 a 500, sem relação com os slots.
//
// Duas afirmações, e a segunda é a que faz este arquivo valer a pena:
//
//   1. As variáveis `--z-*` do `:root` batem, valor a valor, com o `Z` do TypeScript. Duas fontes que se
//      copiam divergem — foi assim que `DomQuery` virou dezesseis cópias e `Gfx`, cinco.
//   2. A dívida de adoção é uma LISTA NOMEADA que só encolhe. Todo `z-index` literal do CSS ou está nela,
//      com o motivo, ou reprova. É o mesmo formato do orçamento de tipos do ADR-0043, e existe pelo mesmo
//      motivo: uma dívida que não é contada cresce sem ninguém decidir.
//
// ========================= POR QUE AS VARIÁVEIS EXISTEM SEM CONSUMIDOR =========================
// Mesma razão que a Fase C deu ao barramento tipado: o contrato precisa nascer certo em vez de ser retipado
// depois. E aqui há um motivo a mais — adotar os slots INVERTE três ordens que hoje valem, e inverter ordem
// é decisão de produto, não refatoração. As três estão nomeadas em `NAO_ADOTADOS` abaixo.
//
// As MUTAÇÕES CONFERIDAS estão no fim do arquivo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Z } from '../app/js/core/layers.js';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');

/** `--z-touch-controls` ← `TOUCH_CONTROLS`. A tradução é mecânica: minúsculas e `_` vira `-`. */
const nomeCss = (slot) => '--z-' + slot.toLowerCase().replace(/_/g, '-');

/** Os slots de OVERLAY: tudo de `Z` a partir do `HUD`. O mundo não vira variável de CSS — ele é PIXI. */
const SLOTS_OVERLAY = Object.entries(Z).filter(([, v]) => v >= Z.HUD);

/**
 * OS `z-index` LITERAIS QUE AINDA NÃO ADOTARAM UM SLOT, com o motivo de cada um. Esta lista só encolhe.
 *
 * Ela não é desculpa: cada linha é uma decisão que falta, e três delas mudam a tela.
 */
const NAO_ADOTADOS = {
  1: 'SEM SLOT, e de propósito: `#dom-layer` (issue #82) não é uma CAMADA — é o invólucro que separa o DOM da canvas para o filtro de acessibilidade poder cair nele. O `1` só o põe acima da canvas e abaixo dos dois pseudo-elementos do CRT; os slots de `Z` valem para os filhos DENTRO dele.',
  4: 'INVERSÃO PENDENTE: `#game-hud`. Ele cria CONTEXTO DE EMPILHAMENTO, e o `.screen-pause` (6) vive dentro dele — adotar HUD(24000) exige decidir se o menu de pausa sai do contexto do HUD.',
  5: 'SEM SLOT: `crt-vig-1::before`. O CRT é PÓS-PROCESSO pelo ADR-0020, não camada; inventar número repete o erro de categoria.',
  6: 'Depende do 4: `.screen-pause` e `.pause-incanvas` competem dentro do contexto do `#game-hud`.',
  8: 'INVERSÃO PENDENTE: `.caption` e `#viz-overlay` estão ABAIXO do toque (14); canonicamente CAPTIONS(26000) fica ACIMA de TOUCH_CONTROLS(25000). A inversão CONSERTA um defeito de surdez — controle de toque cobrindo legenda —, mas muda a tela.',
  12: 'INVERSÃO PENDENTE: o seletor do desafio está ABAIXO do toque (14); canonicamente DIALOGUE(27000) fica acima. Escrito sem o nome da classe de propósito: o gate de fronteira varre vocabulário de jogo em teste de engine, e ele tem razão — o nome não é necessário aqui, o próprio 12 identifica.',
  14: 'Depende do 8 e do 12: `#touch-controls` é o outro lado das duas inversões.',
  15: '`.touch-start` vive DENTRO do contexto do `#touch-controls` (14) — segue o pai.',
  20: '`#viz-indicator`: a bolinha do modo de visão não tem slot óbvio — é a11y de mundo desenhada em DOM.',
  50: '`.overlay` fora do `#game-region` — mesma decisão do 60.',
  60: '`#game-region .overlay` → MENU(30000). Sem inversão, mas não se adota sozinho: escala misturada no mesmo contexto é pior que escala velha.',
  100: 'O `Z` ERRA, não o CSS: o comentário põe o skip-link em CAPTIONS(26000), o que o deixaria ABAIXO de MENU(30000) — um "pular para o conteúdo" embaixo de um modal não é alcançável.',
  500: 'SEM SLOT: `crt-scan-1::after`. Idem ao 5 — pós-processo, e é o que cobre canvas E menus hoje.',
};

/** Todo `z-index: N` do CSS, com o número. Ignora `z-index:auto` e as menções em comentário. */
function literaisDoCss() {
  const out = [];
  for (const m of CSS.matchAll(/z-index:\s*(-?\d+)/g)) out.push(Number(m[1]));
  return out;
}

describe('ADR-0020 · a faixa de OVERLAY é a MESMA no CSS e no TypeScript', () => {
  it('[Right] cada slot de overlay tem a variável `--z-*` com o valor idêntico', () => {
    const divergem = [];
    for (const [slot, valor] of SLOTS_OVERLAY) {
      const re = new RegExp(nomeCss(slot).replace(/-/g, '\\-') + ':\\s*(\\d+)');
      const m = CSS.match(re);
      if (!m) { divergem.push(`${slot}: falta ${nomeCss(slot)} no :root`); continue; }
      if (Number(m[1]) !== valor) divergem.push(`${slot}: CSS diz ${m[1]}, Z diz ${valor}`);
    }
    expect(divergem, divergem.join(' | ')).toEqual([]);
  });

  it('[Interface] a lista de slots é DESCOBERTA do `Z`, não escrita aqui', () => {
    // Sem isto, acrescentar um slot novo ao `Z` não faria nada ficar vermelho, e a variável nasceria
    // faltando — que é exatamente a divergência que este arquivo existe para impedir.
    expect(SLOTS_OVERLAY.length).toBeGreaterThanOrEqual(10);
    expect(SLOTS_OVERLAY.map(([k]) => k)).toContain('CAPTIONS');
    expect(SLOTS_OVERLAY.map(([k]) => k)).toContain('DEBUG');
  });
});

describe('ADR-0020 · a dívida de adoção do overlay só encolhe', () => {
  it('[Right] todo `z-index` literal do CSS está na lista NAO_ADOTADOS, com motivo', () => {
    const semMotivo = [...new Set(literaisDoCss())].filter((n) => !(n in NAO_ADOTADOS));
    expect(semMotivo, 'z-index literal novo e sem motivo declarado: ' + semMotivo.join(', ')).toEqual([]);
  });

  it('[Inverse] a lista não guarda valor que já saiu do CSS — dívida paga some daqui', () => {
    // A metade que faz a lista ENCOLHER. Sem ela, adotar um slot deixaria a linha órfã para trás, e a lista
    // passaria a descrever um passado — que é como uma lista de exceções vira decoração.
    const presentes = new Set(literaisDoCss());
    const orfaos = Object.keys(NAO_ADOTADOS).map(Number).filter((n) => !presentes.has(n));
    expect(orfaos, 'valor na lista que não existe mais no CSS: ' + orfaos.join(', ')).toEqual([]);
  });

  it('[Interface] cada motivo diz ALGUMA coisa — linha sem razão é linha que ninguém revisa', () => {
    for (const [valor, motivo] of Object.entries(NAO_ADOTADOS)) {
      expect(motivo.length, `motivo curto demais no z-index ${valor}`).toBeGreaterThan(40);
    }
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocar `--z-captions:26000` por `26001` no `style.css`
//       → "CAPTIONS: CSS diz 26001, Z diz 26000"
//   · acrescentar `.foo{z-index:7}` ao `style.css`
//       → "z-index literal novo e sem motivo declarado: 7"
//   · apagar o `z-index:12` do seletor do desafio sem tirar o 12 de NAO_ADOTADOS
//       → "valor na lista que não existe mais no CSS: 12"

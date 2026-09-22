// SPDX-License-Identifier: AGPL-3.0-or-later
// OS PADRÕES QUE FALTAVAM, E O NÍVEL TEA QUE SE ESQUECIA A CADA SESSÃO (issue #61).
//
// ========================= O QUE A MEDIÇÃO ACHOU, E POR QUE ISTO É UM CONSERTO =========================
// A marca do ADR-0029 lê `DEFAULTS` e mais nada — regra da issue #61, e ela está certa: se lesse duas fontes,
// o dia em que elas divergissem seria o dia em que a marca mentiria. A consequência é que **um valor sem
// padrão nomeado em `DEFAULTS` é um valor que a marca não pode marcar**, e cinco dos sete ícones da barra
// rápida caíam nisso.
//
// ⚠️ AO IR DAR NOME AOS PADRÕES, DOIS DELES ERAM DEFEITOS E NÃO OMISSÕES:
//
//   1. O NÍVEL TEA NÃO PERSISTIA. `ui/pause-icons` guardava-o num `let calmMode = 0` com o comentário
//      «deliberately NOT persisted — **verbatim**: game.js never wrote it to storage». O «verbatim» é o que o
//      desqualifica como decisão: foi PRESERVADO na extração do monólito, não escolhido. E o ADR-0028 diz
//      que todo menu persiste.
//
//      O custo era da criança que mais precisa dele: quem usa o modo SILENCIOSO voltava a pô-lo a cada
//      sessão — e é para quem o barulho inesperado custa mais. Um ajuste que se esquece não é um ajuste, é
//      uma tarefa diária.
//
//   2. `p.viz` NÃO TINHA PADRÃO. O snapshot da barra fazia `p.viz || ''`, e funcionava por ACIDENTE: a
//      cadeia vazia não casa `hc-direto` nem `fix-*`, então os dois ícones ficavam apagados pelo motivo
//      certo por engano. `render/viz-modes` já declarava o modo `normal` com `kind:'normal'` — o que não faz
//      nada — e faltava alguém dizer que é ele o padrão.
//
// A persistência propriamente dita (ida ao `localStorage`) prova-se no project BROWSER, em
// `pause-icons.browser.test.js`; aqui ficam o contrato dos padrões e o saneamento, que são lógica pura.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { DEFAULTS } from '../app/js/core/state.js';
import { sanitiseTeaLevel, CALM_NAMES } from '../app/js/ui/pause-icons.js';
import { KEYS } from '../app/js/platform/storage.js';
import { VIZ_MODES } from '../app/js/render/viz-modes.js';

describe('os padrões que faltavam ao DEFAULTS (#61)', () => {
  it('⚠️ [Right] o nível TEA e o modo de visão têm padrão NOMEADO', () => {
    // Sem estes dois nomes, a marca do ADR-0029 não pode marcar cinco dos sete ícones da barra rápida — e
    // uma barra com dois marcados e cinco não diz «não mexeste nestes cinco», que é falso.
    expect(DEFAULTS.calmMode, 'o nível TEA voltou a não ter padrão').toBe(0);
    expect(DEFAULTS.viz, 'o modo de visão voltou a não ter padrão').toBe('normal');
  });

  it('⚠️ [Interface] o padrão do `viz` é um modo que NÃO FAZ NADA, e é `render/viz-modes` quem o diz', () => {
    // O padrão não pode ser uma cadeia qualquer que por acaso não case os prefixos: tem de ser um modo real
    // e neutro. Se alguém puser `DEFAULTS.viz` num modo que corrige ou simula, a criança começa a partida
    // dentro de um ajuste que não pediu — e este caso reprova.
    const modo = VIZ_MODES.find((m) => m.key === DEFAULTS.viz);
    expect(modo, `DEFAULTS.viz não é um modo de viz-modes: ${DEFAULTS.viz}`).toBeTruthy();
    expect(modo.kind, 'o padrão do viz deixou de ser o modo neutro').toBe('normal');
  });

  it('[Interface] o nível TEA tem chave de armazenamento própria', () => {
    expect(KEYS.tea).toBe('incl_tea');
  });
});

describe('o nível TEA saneado — dado do navegador é dado de fora', () => {
  it('[Right] os três níveis válidos atravessam intactos', () => {
    for (let n = 0; n < CALM_NAMES.length; n++) expect(sanitiseTeaLevel(n)).toBe(n);
    expect(CALM_NAMES).toHaveLength(3); // normal · calmo · silencioso
  });

  it('⚠️ [Error] qualquer outra coisa volta ao padrão, e o motivo é o anúncio', () => {
    // `CALM_NAMES[3]` é `undefined`, e o ciclo do ícone faz `t(CALM_NAMES[calmMode])` para ANUNCIAR o nível
    // ao leitor de tela. Um nível fora da lista sairia como anúncio vazio — a criança cega carregaria no
    // botão e não ouviria nada, que é a forma mais silenciosa de um controlo de acessibilidade falhar.
    for (const lixo of [3, -1, 1.5, NaN, Infinity]) {
      expect(sanitiseTeaLevel(lixo), `${lixo} passou como nível`).toBe(DEFAULTS.calmMode);
    }
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando `calmMode: 0` do `DEFAULTS` → "[Right] padrão NOMEADO" reprova (e o `tsc` reprova junto, que é
//     o melhor dos dois mundos: o gate diz porquê e o compilador impede de chegar ao gate).
//   · trocando `DEFAULTS.viz` para `'hc-direto'` → "[Interface] o padrão é um modo que NÃO FAZ NADA" reprova
//     no `kind`. É a mutação que importa: `'hc-direto'` É um modo real, então um caso que só verificasse
//     «existe em VIZ_MODES» ficaria verde a pôr toda a criança em alto contraste por omissão.
//   · trocando o `>= 0 && < CALM_NAMES.length` de `sanitiseTeaLevel` por `>= 0` → "[Error]" reprova no 3, que
//     é exactamente o valor que produz o anúncio vazio.
//   · trocando `Number.isInteger` por `typeof === 'number'` → "[Error]" reprova no 1.5 e no NaN.

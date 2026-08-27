// SPDX-License-Identifier: AGPL-3.0-or-later
// AS CINCO NOTAÇÕES DE FRAÇÃO NÃO SÃO BOTÕES DE MENU — são AJUSTES, e precisavam parecer.
//
// ========================= O QUE O DEV VIU =========================
// "Math > fractions > 5 primeiras opções: deveriam estar dentro de um frame ou separadas do resto das opções
// com toggle na frente, e não como botões."
//
// Elas eram `.title-btn` — a MESMA classe dos itens que ABREM uma atividade — empilhadas logo acima deles.
// Para quem enxerga, cinco coisas com a cara de "entrar" que na verdade LIGAM e DESLIGAM. Para quem navega
// por escuta é pior: o cursor atravessa dez itens seguidos em que os cinco primeiros respondem "ligado/
// desligado" e os cinco últimos começam uma partida, sem nada entre eles dizendo que a regra mudou.
//
// É a mesma doença do cartão de pausa que o item 5 do ADR-0044 curou: dois modelos de interação numa tela só,
// sem fronteira. Lá a resposta foi separar em duas listas; aqui é dar MOLDURA e MARCA aos ajustes.
//
// ========================= O QUE MUDA, E O QUE NÃO PODE MUDAR =========================
//   · MOLDURA com nome: um `<fieldset>`/`<legend>`, que é a fronteira que o leitor de tela anuncia ao entrar.
//   · MARCA na frente: `☑`/`☐` visível, para que o estado se veja sem depender de cor.
//   · PAPEL de caixa de seleção (`role="checkbox"` + `aria-checked`), e não de botão de comando.
//
// ⚠️ CONTINUAM SENDO `<button>`, e isso é deliberado: `titleButtons()` varre `button` para montar o anel de
// navegação (`m.querySelectorAll('button')`). Trocar por `<input type="checkbox">` tiraria as cinco do anel —
// elas ficariam inalcançáveis pelo direcional, que é exatamente quem mais precisa delas.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { fracNotsHtml, frMenuHtml, FNOT_KEYS } from '../app/js/ui/activities-menu.js';

const LIGADAS = { v: 1, d: 0, dec: 1, pct: 0, mix: 0 };

describe('notações de fração · ajuste com moldura e marca, não botão de menu', () => {
  it('[Right] as cinco vivem numa MOLDURA com nome', () => {
    const h = fracNotsHtml(LIGADAS);
    expect(h).toContain('<fieldset');
    expect(h).toContain('<legend');
    // O nome da moldura é o que separa "escolher notação" de "escolher atividade" para quem escuta.
    expect(h).toMatch(/<legend[^>]*>[^<]{3,}<\/legend>/);
  });

  it('[Right] cada uma é CAIXA DE SELEÇÃO, não botão de comando', () => {
    const h = fracNotsHtml(LIGADAS);
    expect((h.match(/role="checkbox"/g) || []).length).toBe(FNOT_KEYS.length);
    expect(h, 'aria-pressed é de alternador de COMANDO; aqui a pergunta é "está marcada?"').not.toContain('aria-pressed');
    expect((h.match(/aria-checked="true"/g) || []).length).toBe(2);  // v e dec
    expect((h.match(/aria-checked="false"/g) || []).length).toBe(3);
  });

  it('[Right] a marca é VISÍVEL e acompanha o estado — sem depender de cor', () => {
    // O estado antes era só cor de fundo (`.tab-on`). Cor sozinha reprova a WCAG 1.4.1, e para quem tem
    // baixa visão ou daltonismo o menu ficava sem resposta à pergunta "quais estão ligadas?".
    const h = fracNotsHtml(LIGADAS);
    expect((h.match(/☑/g) || []).length, 'faltou marca nas ligadas').toBe(2);
    expect((h.match(/☐/g) || []).length, 'faltou marca nas desligadas').toBe(3);
  });

  it('[Right] elas NÃO usam mais a classe dos botões que abrem atividade', () => {
    // A classe é o que dava a elas a cara de "entrar". Enquanto for a mesma, nenhuma moldura conserta a
    // confusão para quem enxerga.
    const h = fracNotsHtml(LIGADAS);
    expect(h, 'a notação continua com a cara de botão de menu').not.toContain('title-btn');
  });

  it('[Interface] continuam sendo `<button>` — senão saem do anel de navegação', () => {
    // `titleButtons()` varre `button` para montar o anel. Um `<input type="checkbox">` seria mais "correto"
    // em papel e tiraria as cinco do alcance do direcional — quem mais precisa delas é quem só tem ele.
    const h = fracNotsHtml(LIGADAS);
    expect((h.match(/<button/g) || []).length).toBe(FNOT_KEYS.length);
  });

  it('[Zero] o submenu de fração continua com as cinco notações E as seis atividades', () => {
    // A separação não pode ter custado item nenhum: o que mudou é a fronteira, não o conteúdo.
    const h = frMenuHtml(LIGADAS);
    expect((h.match(/data-fnot=/g) || []).length).toBe(5);
    expect((h.match(/data-act-id=/g) || []).length).toBe(6);
    expect(h).toContain('data-tm-back');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · devolvendo `class="title-btn tab-num"` às notações → "[Right] elas NÃO usam mais a classe" reprova.
//   · devolvendo `aria-pressed` no lugar de `aria-checked` → "[Right] cada uma é CAIXA DE SELEÇÃO" reprova.
//   · tirando a marca ☑/☐ (deixando só a cor de fundo) → "[Right] a marca é VISÍVEL" reprova.

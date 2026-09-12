// SPDX-License-Identifier: AGPL-3.0-or-later
// MOUNTING A SETTINGS PANEL — the gate for `ui/mount-panel.ts` (ADR-0106 §1, ADR-0122).
//
// ========================= WHY THIS IS A BROWSER CASE =========================
// The rule this file inherits from `boot-create-game.browser.test.js` is the one that keeps it from being an
// expensive duplicate: **a case belongs here only if the fake DOM could not do it.** Everything here is that
// kind — whether the overlay is really IN THE TREE, whether focus actually LANDS, whether a real click walks
// the whole path, and whether `hidden` is honoured by the element rather than by a boolean we set ourselves.
//
// 🔴 AND ONE CASE EXISTS BECAUSE I WROTE THE DEFECT FIRST. The focus fallback was `casca.lista`, which is a
// `div[role=group]` with no `tabindex`: `.focus()` on it does nothing and reports nothing. A fake DOM would
// have recorded the call and passed. A real one moves focus or does not, and that is the whole question.
//
// MUTATIONS CONFIRMED at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { montarPainel } from '../app/js/ui/mount-panel.js';

let host;
let registados;

const ctx = () => ({
  procurar: (s) => document.querySelector(s),
  criar: (t) => document.createElement(t),
  host,
  overlays: {
    frontOverlay: (el) => { el.dataset.aFrente = '1'; },
    register: (id, entry) => { registados.set(id, entry); },
    restoreFocus: (id) => { registados.set(`${id}:foco-reposto`, true); },
  },
});

const spec = (extra = {}) => ({
  id: 'fixture',
  rotulos: () => ({
    titulo: `Fixture ${idioma}`,
    rotuloDaLista: 'Lista da fixture',
    rotuloReset: 'Repor',
    rotuloFechar: 'Fechar',
  }),
  render: () => { renderizou += 1; },
  ...extra,
});

let renderizou = 0;
// O idioma que o arranque ainda não tem. O `initI18n` aplica o de recuo de forma síncrona e PEDE o preferido
// depois; esta variável é esse intervalo, escrito de forma que um caso o possa atravessar.
let idioma = 'pt';

beforeEach(() => {
  host = document.createElement('div');
  host.id = 'hospedeiro-de-teste';
  document.body.appendChild(host);
  registados = new Map();
  renderizou = 0;
  idioma = 'pt';
});

afterEach(() => { host.remove(); });

describe('ADR-0106 · a engine monta o painel, e o consumidor não escreve nenhuma das cinco linhas', () => {
  it('⚠️ [Interface] a casca entra NA ÁRVORE do hospedeiro e nasce escondida', () => {
    // O fixture não consegue responder «está na árvore»: ele regista um `appendChild` e acredita nele.
    const p = montarPainel(ctx(), spec());
    expect(host.contains(p.casca.overlay), 'o overlay não ficou dentro do hospedeiro').toBe(true);
    expect(document.getElementById('fixture'), 'o id da casca não chegou ao documento').toBe(p.casca.overlay);
    expect(p.casca.overlay.hidden, 'um painel que nasce aberto é um painel que ninguém abriu').toBe(true);
  });

  it('🎯 [Right] abrir RENDERIZA, revela, traz à frente e põe o foco DENTRO do cartão', () => {
    // As quatro coisas que as vinte e cinco linhas do quiz faziam à mão, numa chamada.
    const p = montarPainel(ctx(), spec());
    const botao = document.createElement('button');
    botao.textContent = 'uma opção';
    p.casca.lista.appendChild(botao);

    p.abrir();
    expect(renderizou, 'abrir não chamou o render do painel').toBe(1);
    expect(p.casca.overlay.hidden).toBe(false);
    expect(p.casca.overlay.dataset.aFrente, 'não foi trazido à frente da pilha').toBe('1');
    expect(p.casca.card.contains(document.activeElement), 'o foco ficou FORA de um diálogo modal').toBe(true);
    // 🔴 ADR-0158: the cursor lands on «Voltar», item 1 — even with a live control in the list, which is the case
    // that used to take the focus.
    expect(document.activeElement, 'the panel opened with the cursor away from its way out').toBe(p.casca.fechar);
  });

  it('🔴 [Boundary] sem controle na lista, o foco cai no VOLTAR — nunca num `div` que não o aceita', () => {
    // O defeito que eu escrevi e este caso apanhou: `casca.lista` é `div[role=group]` sem `tabindex`, e
    // `.focus()` nele não faz nada E NÃO DIZ NADA. Num DOM falso isto passava.
    const p = montarPainel(ctx(), spec());
    p.abrir();
    expect(document.activeElement, 'o foco não pousou em elemento nenhum').toBe(p.casca.fechar);
    expect(document.activeElement).not.toBe(p.casca.lista);
  });

  it('⚠️ [Right] um clique DE VERDADE no fechar esconde e devolve o foco a quem abriu', () => {
    const p = montarPainel(ctx(), spec());
    p.abrir();
    p.casca.fechar.click();
    expect(p.casca.overlay.hidden, 'o clique no fechar não escondeu o painel').toBe(true);
    expect(registados.get('fixture:foco-reposto'), 'o foco não voltou a quem abriu (WCAG 2.4.3)').toBe(true);
  });

  it('🎯 [Right] o painel ENTRA na cadeia do Escape — o registo estava vazio sob o `createGame`', () => {
    // Sem isto, `settings-panel.escapeTarget()` percorre um registo vazio: um diálogo modal que tecla
    // nenhuma fecha é a armadilha que o ADR-0044 §2 nomeia sobre a própria pausa.
    const p = montarPainel(ctx(), spec());
    const entrada = registados.get('fixture');
    expect(entrada, 'o painel não se registou na pilha de overlays').toBeTruthy();
    expect(entrada.inEscapeChain, 'registou-se FORA da cadeia do Escape').toBe(true);
    p.abrir();
    entrada.close();
    expect(p.casca.overlay.hidden, 'o fecho da cadeia do Escape não escondeu o painel').toBe(true);
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM painel — é o terceiro gate do ADR-0139', () => {
    // «Two cartridges mounted in sequence leave exactly one accessibility bar in the document.» A mesma
    // afirmação, na superfície mais pequena onde ela se pode medir hoje.
    montarPainel(ctx(), spec());
    montarPainel(ctx(), spec());
    expect(document.querySelectorAll('#fixture').length, 'duas montagens deixaram dois painéis').toBe(1);
  });

  it('🎯 [Right] o IDIOMA QUE CHEGA DEPOIS DO ARRANQUE alcança o título, sem remontar a casca', () => {
    // O `initI18n` aplica o idioma de recuo de forma síncrona e pede en/es depois. Um painel montado nesse
    // intervalo ficava com o título de recuo — o mesmo defeito que a barra de ícones pagou em 08/09. Aqui a
    // janela é atravessada de propósito: monta em «pt», o idioma chega, e só então a criança abre.
    const p = montarPainel(ctx(), spec());
    expect(p.casca.titulo.textContent).toBe('Fixture pt');
    idioma = 'en';
    p.abrir();
    expect(p.casca.titulo.textContent, 'o título ficou no idioma de recuo depois de o preferido chegar').toBe('Fixture en');
  });

  it('⚠️ [Boundary] retraduzir NÃO remonta a casca: a escuta que o painel ligou no repor sobrevive', () => {
    // `montarCasca` esvazia o cartão, e cada `ui/settings-*` liga o seu `#X-reset` UMA VEZ no `init`. Corrigir
    // o título por remontagem deixaria o botão de repor no documento e sem escuta — um botão morto com
    // aparência de vivo, que é precisamente o que o ADR-0106 §5 proíbe.
    const p = montarPainel(ctx(), spec());
    let reposto = 0;
    p.casca.reset.addEventListener('click', () => { reposto += 1; });
    const mesmoNo = p.casca.reset;
    idioma = 'en';
    p.abrir();
    // Pelo DOCUMENTO e não pela casca: uma remontagem devolveria um botão novo com o mesmo id, e o antigo
    // — o que tem a escuta — sairia da árvore sem ninguém reparar.
    const noDocumento = document.getElementById('fixture-reset');
    expect(noDocumento, 'o botão de repor no documento não é o que o painel ligou').toBe(mesmoNo);
    expect(noDocumento.textContent, 'o rótulo do repor não foi retraduzido').toBe('Repor');
    noDocumento.click();
    expect(reposto, 'a escuta do repor morreu na retradução').toBe(1);
  });

  it('[Boundary] uma introdução que SOME apaga o `data-explain-idle` — não sobrevive ao idioma anterior', () => {
    // Um dicionário sem a chave é uma introdução ausente. Deixar de escrever não chega: o atributo antigo
    // ficaria, e o rodapé descansaria no idioma que a criança acabou de deixar.
    const p = montarPainel(ctx(), spec({
      rotulos: () => ({
        titulo: 'Fixture', rotuloDaLista: 'Lista', rotuloReset: 'Repor', rotuloFechar: 'Fechar',
        ...(idioma === 'pt' ? { introducao: 'Escolha uma fonte.' } : {}),
      }),
    }));
    expect(p.casca.card.getAttribute('data-explain-idle')).toBe('Escolha uma fonte.');
    idioma = 'en';
    p.abrir();
    expect(p.casca.card.hasAttribute('data-explain-idle'), 'a introdução do idioma anterior sobreviveu').toBe(false);
  });

  it('🎯 [Right] com `fecharProprio`, o botão tem UM dono — e a cadeia do Escape usa o MESMO', () => {
    // 📏 Três dos oito painéis têm `close()` próprio, e dois deles (`caa`, `empathy`) ligam o `#X-close`
    // sozinhos no init. Ligar aqui um segundo ouvinte punha dois donos no mesmo botão; e, pior, a cadeia do
    // Escape usaria o desta casca enquanto o botão usava o do painel — uma saída, dois caminhos.
    let fechou = 0;
    const meuFechar = () => { fechou += 1; };
    const p = montarPainel(ctx(), spec({ fecharProprio: meuFechar }));
    p.abrir();
    p.casca.fechar.click();
    expect(fechou, 'a casca ligou um ouvinte por cima do que o painel já tinha').toBe(0);

    // e a cadeia do Escape fecha pelo caminho DO PAINEL, não por um closer paralelo desta casca
    registados.get('fixture').close();
    expect(fechou, 'o Escape fechou por um caminho que o botão não usa').toBe(1);
    expect(p.fechar, 'o `fechar` devolvido não é o do painel').toBe(meuFechar);

    // ⚠️ E a casca NÃO esconde por conta própria: quem sabe o que fechar significa neste painel é ele.
    expect(p.casca.overlay.hidden, 'a casca escondeu por trás do closer do painel').toBe(false);
  });

  it('[Right] o render corre a CADA abertura, não uma vez na montagem', () => {
    // Um painel que renderiza uma vez mostra estado velho depois de a criança mexer no mesmo ajuste pela
    // barra rápida — e o `fillExplain` tem de correr outra vez ou a prosa volta para dentro das linhas.
    const p = montarPainel(ctx(), spec());
    expect(renderizou, 'montar não devia renderizar').toBe(0);
    p.abrir(); p.fechar(); p.abrir();
    expect(renderizou).toBe(2);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
// Cada uma aplicada por script a ficheiro, com contagem de ocorrências antes de aplicar.
//   · 🔴 devolver o foco a `casca.lista` em vez de `casca.fechar` -> reprova o [Boundary]. É o defeito que
//     eu escrevi na primeira versão, e é a razão de este ficheiro ser de NAVEGADOR: um `div[role=group]` sem
//     `tabindex` aceita a chamada `.focus()` e não move nada. Um DOM falso regista a chamada e passa.
//   · tirar o `register` da pilha -> reprova o caso da cadeia do Escape. Sem ele o painel abre e nenhuma
//     tecla o fecha, que é a armadilha do ADR-0044 §2 aplicada a um diálogo modal.
//   · tirar o `restoreFocus` do fechar -> reprova o caso do clique. O foco fica no nada depois de fechar,
//     e quem navega por teclado recomeça do topo do documento (WCAG 2.4.3).
//   · chamar `spec.render()` na montagem em vez de na abertura -> reprova o último caso (conta 1, não 0).
//   · tirar o `appendChild` -> reprova o [Interface] PRIMEIRO: a casca existe e não está em lado nenhum,
//     que é exactamente «o painel abre vazio, sem erro» visto do outro lado.
//   · resolver os rótulos SÓ na montagem (tirar o `aplicarRotulos` do `abrir`) -> reprova dois: o título fica
//     no idioma de recuo, e a introdução do idioma anterior sobrevive. É o defeito que a barra de ícones já
//     pagou em 08/09, reproduzido num painel.
//   · retraduzir REMONTANDO a casca (trocar `aplicarRotulos` por `montarCasca`) -> reprova seis, e a que
//     importa é a do repor: `montarCasca` esvazia o cartão, o botão com a escuta sai da árvore e fica lá um
//     homónimo mudo. Um botão morto com aparência de vivo é pior do que um ausente (ADR-0106 §5).
//   · a introdução ausente deixar de APAGAR o `data-explain-idle` (tirar o `else removeAttribute`) -> reprova
//     o caso da introdução: deixar de escrever não é apagar, e o rodapé descansa no idioma anterior.
//   · (2026-09-12, ADR-0158) focus on the first live control of the list instead of «Voltar» -> the [Right] open case
//     is red: that is exactly the old fallback, and the panel would open with the cursor away from its way out.

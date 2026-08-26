// SPDX-License-Identifier: AGPL-3.0-or-later
// O MENU DE ABERTURA — largura que não quebra linha, e submenus que são LISTAS, não grades (ADR-0044).
//
// ========================= O QUE O DEV VIU, E POR QUE É A11Y E NÃO ESTÉTICA =========================
// Duas observações dele, no mesmo pedido:
//
//   · o `#tm-main` tinha 13em e os rótulos passavam a ocupar DUAS linhas. Um botão de duas linhas muda de
//     altura conforme o texto, e o texto muda com o idioma — a mesma tela tem uma geometria em pt-BR e outra
//     em espanhol. Quem navega por escuta não percebe; quem navega por resto de visão perde o alinhamento que
//     usava para se orientar.
//
//   · os outros submenus da abertura eram GRADES de duas colunas, e a navegação por seta anda em ordem de DOM.
//     Numa grade de duas colunas isso significa que "para baixo" pula para a coluna da direita. O anel do
//     ADR-0044 (item 1) já estava certo no código — `nextTitleIndex` dá a volta —, e era o LAYOUT que mentia
//     sobre ele: a criança apertava para baixo e o foco atravessava a tela. Virar lista vertical não muda a
//     lógica; faz o que se vê coincidir com o que já acontecia.
//
// Uma lista vertical de onze frações não cabe no quadro, e por isso ela ROLA — foi o que o Dev pediu com
// todas as letras. Rolagem aqui é o preço de a ordem visual ser a ordem de navegação, e é o preço certo:
// `focus()` leva o item para dentro da janela sozinho, então quem anda por teclado ou controle nunca perde
// o foco fora da vista.
//
// ========================= POR QUE UM GATE DE CSS, E NÃO "ficou bom na tela" =========================
// Porque a regressão aqui é silenciosa. Alguém devolve `grid-template-columns:1fr 1fr` para caber mais coisa,
// a tela fica mais bonita, e a navegação por seta volta a pular de coluna sem que nada reprove. É a mesma
// razão do gate de contraste: a promessa e a tela não podem divergir em silêncio.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');
/** Sem comentários: `/* … *\/` entre duas regras vira parte do seletor da seguinte e nada casa. Aprendido
 *  ao escrever este arquivo — o `[Zero]` reprovou primeiro, e reprovou pelo motivo certo. */
const LIMPO = CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Os cinco submenus da abertura. O `#tm-main` fica DE FORA de propósito: ele é a lista curta, sem rolagem. */
const SUBMENUS = ['#tm-alf', '#tm-mat', '#tm-tab', '#tm-fr', '#tm-cen'];

const BLOCO = /([^{}]+)\{([^}]*)\}/g;

/**
 * Declarações que alcançam `sel`, na ordem do arquivo — a última é a que vale.
 *
 * Casa por TOKEN de seletor, e não por `includes`: `#tm-fr` não pode casar `#tm-frac`, e `#tm-fr .title-btn`
 * é uma regra sobre os BOTÕES, não sobre a lista. Só entram regras em que o seletor termina no token.
 */
function declaracoes(sel) {
  const out = [];
  for (const m of LIMPO.matchAll(BLOCO)) {
    const alcanca = m[1].split(',').some((s) => s.trim() === sel);
    if (!alcanca) continue;
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) out.push([d.slice(0, i).trim(), d.slice(i + 1).trim()]);
    }
  }
  return out;
}
/** Valor EFETIVO de uma propriedade: a última declaração que a define. */
function prop(sel, nome) {
  const hits = declaracoes(sel).filter(([k]) => k === nome);
  return hits.length ? hits[hits.length - 1][1] : null;
}
const em = (v) => (v && /^([\d.]+)em$/.test(v) ? parseFloat(v) : NaN);

describe('menu de abertura · largura de uma linha e submenus em lista vertical', () => {
  it('[Zero] o gate está lendo o style.css de verdade', () => {
    // Sem isto, renomear o arquivo deixaria os casos abaixo verdes por não medirem nada.
    expect(CSS.length).toBeGreaterThan(5000);
    expect(declaracoes('.title-menu').length).toBeGreaterThan(0);
  });

  it('[Right] o menu principal tem o DOBRO da largura base — rótulo em UMA linha', () => {
    const base = em(prop('.title-menu', 'width'));
    const principal = em(prop('#tm-main', 'width'));
    expect(base, '.title-menu perdeu a largura em `em` — o gate mede relação, não pixel').not.toBeNaN();
    expect(principal, '#tm-main não declara largura própria: voltou a herdar a estreita').not.toBeNaN();
    expect(principal, `#tm-main (${principal}em) precisa ser o dobro da base (${base}em)`).toBeGreaterThanOrEqual(base * 2);
  });

  it('[Right] nenhum submenu da abertura é grade de duas colunas', () => {
    // A grade é o que fazia "para baixo" pular para a coluna da direita. Se voltar, esta é a linha que reprova.
    const grades = SUBMENUS
      .map((s) => [s, prop(s, 'grid-template-columns')])
      .filter(([, v]) => v && v.trim().split(/\s+/).length > 1)
      .map(([s, v]) => `${s}: ${v}`);
    expect(grades, 'submenu da abertura voltou a ser grade — a seta passa a andar em ordem de DOM, não do que se vê: ' + grades.join(' | ')).toEqual([]);
  });

  it('[Right] cada submenu da abertura ROLA em vez de transbordar', () => {
    // Uma lista vertical de onze itens não cabe no quadro. Sem rolagem ela sai por baixo do canvas e os itens
    // do fim ficam inalcançáveis — o `quit` do menu inicial é o "Voltar", e ele é o ÚLTIMO.
    const faltam = SUBMENUS
      .filter((s) => !/auto|scroll/.test(prop(s, 'overflow-y') || '') || !prop(s, 'max-height'))
      .map((s) => `${s}: overflow-y=${prop(s, 'overflow-y')} max-height=${prop(s, 'max-height')}`);
    expect(faltam, 'submenu sem rolagem declarada — os itens do fim saem do quadro: ' + faltam.join(' | ')).toEqual([]);
  });

  it('[Boundary] o item que ganha o foco não fica embaixo do cabeçalho grudado', () => {
    // MEDIDO no navegador, e é a razão de a linha existir: dando a volta do último para o primeiro, o navegador
    // considerava o primeiro botão "já visível" e não rolava — mas o cabeçalho `sticky` cobria 12px dele. Foco
    // encoberto é foco perdido para quem lê por resto de visão, e nenhum teste de layout em node veria isso.
    // `scroll-margin-top` é o que diz ao navegador onde o quadro ÚTIL começa.
    const falta = SUBMENUS
      .map((s) => [s, em(prop(`${s} .title-btn`, 'scroll-margin-top'))])
      .filter(([, v]) => !(v >= 2))
      .map(([s, v]) => `${s}: ${v}`);
    expect(falta, 'botão sem margem de rolagem — o cabeçalho grudado encobre o foco: ' + falta.join(' | ')).toEqual([]);
  });

  it('[Right] NADA dentro de um submenu da abertura se deita na horizontal', () => {
    // O Dev viu o resultado da primeira volta e cobrou de novo: "menus que não estão na vertical, mas sim
    // MISTOS". Eu tinha aberto duas exceções por conta própria — as cinco notações de fração e as duas
    // fileiras de números da tabuada —, argumentando que são "grupos" e não itens de lista. A régua dele não
    // tem essa distinção, e ela é a régua certa: para quem anda de seta, um grupo deitado é uma parte da
    // lista onde "para baixo" anda para o LADO. A ordem que se vê tem de ser a ordem em que se anda, sem
    // exceção — se houvesse uma, ela apareceria justamente no meio da lista, sem aviso.
    const deitados = [];
    for (const m of LIMPO.matchAll(BLOCO)) {
      const sels = m[1].split(',').map((x) => x.trim()).filter((x) => SUBMENUS.some((s) => x.startsWith(s + ' ')));
      if (!sels.length) continue;
      const decl = Object.fromEntries(m[2].split(';').map((d) => {
        const i = d.indexOf(':');
        return i > 0 ? [d.slice(0, i).trim(), d.slice(i + 1).trim()] : ['', ''];
      }));
      const flexDeitado = decl['display'] === 'flex' && (decl['flex-direction'] || 'row').startsWith('row');
      const gradeLarga = decl['grid-template-columns'] && decl['grid-template-columns'].trim().split(/\s+/).length > 1;
      if (flexDeitado || gradeLarga) deitados.push(sels.join(',') + ' → ' + (decl['display'] || decl['grid-template-columns']));
    }
    expect(deitados, 'container horizontal dentro de um submenu da abertura: ' + deitados.join(' | ')).toEqual([]);
  });

  it('[Interface] o casador de seletor distingue a LISTA dos seus botões', () => {
    // O caso que impede o gate de se enganar sozinho. `#tm-fr .frac-nots{justify-content:center}` não pode ser
    // lido como declaração sobre `#tm-fr`, senão propriedade de filho passaria a valer como propriedade da lista.
    expect(declaracoes('#tm-fr .frac-nots').length).toBeGreaterThan(0);
    expect(declaracoes('#tm-fr').some(([k]) => k === 'justify-content')).toBe(false);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · devolvendo `#tm-alf{grid-template-columns:1fr 1fr}` → "[Right] nenhum submenu é grade" reprova nomeando
//     `#tm-alf: 1fr 1fr`.
//   · tirando `overflow-y:auto` da regra dos cinco → "[Right] cada submenu ROLA" reprova com os cinco nomes.
//   · devolvendo `#tm-main{width:13em}` → "[Right] o dobro da largura base" reprova em "13 >= 26".
//   · tirando `scroll-margin-top` dos botões → "[Boundary] o item que ganha o foco" reprova com os cinco.
//   · devolvendo `display:flex` (sem `flex-direction:column`) a `#tm-fr .frac-nots` → "[Right] NADA se deita
//     na horizontal" reprova nomeando o seletor.

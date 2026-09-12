// SPDX-License-Identifier: AGPL-3.0-or-later
// A BARRA RÁPIDA SAI DO CARTÃO DE PAUSA — item 7 do ADR-0044, e o que ele destrava.
//
// ========================= O QUE ESTAVA MEDIDO =========================
// O cartão tinha 22 paradas: DEZ alternadores de acessibilidade (`role="group"`) e DOZE itens de palavra
// (`role="menu"`), com um `<h2>` no meio. Dois modelos de interação numa tela só, e o leitor de tela
// apresenta tudo em sequência estrita — o que quem vê lê como "uma barra e uma lista" vira, para quem
// escuta, vinte e duas coisas em fila.
//
// O item 5 tirou cinco itens da lista. Este tira os DEZ ícones do cartão inteiro: eles passam a viver no
// HUD, disponíveis DURANTE a partida — que é quando uma criança precisa mudar um ajuste que está a
// atrapalhando agora, e não depois de pausar.
//
// ========================= O QUE ISSO DESTRAVA, E É O MAIOR GANHO =========================
// Sem a barra, a pausa deixa de ser uma GRADE de duas zonas e vira uma LISTA LINEAR. A XAG 106 permite laço
// (`wrap`) para menu linear e o PROÍBE para grade de duas dimensões — era por isso que o anel do item 1
// ainda não fechava aqui. Agora fecha, e com ele a promessa que abriu o ADR-0044:
//
//   `quit` está a UMA tecla para CIMA de `resume`.
//
// Longe na leitura (é o sétimo), perto no dedo (é o vizinho de cima do primeiro). As duas coisas ao mesmo
// tempo, que é o que só um anel consegue.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { screenPauseMarkup, quickBarMarkup } from '../app/js/ui/pause-icons.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/activities-menu.js';
import { passoNoAnel } from '../app/js/ui/menu-nav.js';

const markup = () => screenPauseMarkup({
  player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS, dynLabel: () => null, t: (k) => k,
});

describe('barra rápida · sai do cartão de pausa e vira HUD', () => {
  it('[Right] o cartão de pausa NÃO tem mais ícone nenhum', () => {
    const h = markup();
    expect(h).not.toContain('pi-btn');
    expect(h).not.toContain('pause-icons');
  });

  it('[Right] a barra existe por si, com os onze alternadores e a sua legenda', () => {
    const b = quickBarMarkup();
    expect(b).toContain('class="pause-icons"');
    // ⚠️ ONZE desde 2026-09-12: entrou o ciclo de tipografia (ADR-0149). O número é escrito por extenso de
    // propósito — um ícone que entre ou saia da barra sem alguém reparar é decisão de produto, não etiqueta.
    expect((b.match(/class="pi-btn/g) || []).length).toBe(11);
    // A legenda viaja COM a barra: ela é a dica que substitui, para quem não vê, o `title` que só o mouse
    // revela. Deixá-la para trás no cartão tornaria a barra do HUD muda.
    expect(b).toContain('class="pause-icons-cap"');
    expect(b).toContain('aria-live="polite"');
  });

  it('[Right] a pausa continua com a lista inteira — só os ícones saíram', () => {
    const h = markup();
    expect((h.match(/class="pm-btn/g) || []).length).toBe(PM_BTNS.length + PM_OPTIONS_BTNS.length);
    expect(h).toContain('data-act="resume"');
    expect(h).toContain('data-act="quit"');
  });

  it('[Right] AGORA a pausa é linear, e `quit` fica a UMA tecla de `resume`', () => {
    // A promessa que abriu o ADR-0044, e ela só pôde ser cumprida depois de a barra sair: a XAG 106 permite
    // laço para menu LINEAR e o proíbe para grade de duas dimensões. Enquanto o cartão tivesse duas zonas,
    // dar a volta seria contra a norma; com uma lista só, é o que a norma recomenda.
    const n = PM_BTNS.length;
    expect(PM_BTNS[0].act).toBe('resume');
    expect(PM_BTNS[n - 1].act).toBe('quit');
    expect(passoNoAnel(n, 0, -1), 'para CIMA a partir de `resume` tem de cair em `quit`').toBe(n - 1);
    expect(passoNoAnel(n, n - 1, 1), 'para BAIXO a partir de `quit` tem de voltar a `resume`').toBe(0);
  });

  it('[Zero] a barra é montada UMA vez por chamada e não carrega estado', () => {
    // `quickBarMarkup` é string pura: duas telas de jogador recebem a MESMA marcação e cada uma reflete o
    // estado do SEU jogador depois (o daltonismo é por jogador). Se a função guardasse estado, a segunda
    // tela nasceria com o rótulo da primeira.
    expect(quickBarMarkup()).toBe(quickBarMarkup());
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · devolvendo `iconsMarkup()` ao `screenPauseMarkup` → "[Right] o cartão NÃO tem mais ícone nenhum" reprova.
//   · deixando a `.pause-icons-cap` no cartão em vez de na barra → "[Right] a barra existe por si" reprova,
//     e o efeito real seria uma barra de HUD que não diz o que cada ícone faz.
//   · pondo `quit` antes de `print` em PM_BTNS → "[Right] AGORA a pausa é linear" reprova na última asserção.

// SPDX-License-Identifier: AGPL-3.0-or-later
// O CARTÃO DE PAUSA FALA O IDIOMA DO ARRANQUE — inclusive para quem o ESCUTA.
//
// ========================= O DEFEITO, MEDIDO NUM NAVEGADOR ANTES DE SER ESCRITO =========================
// 🔴 Em 2026-09-12, com o `quiz.html` servido do `dist`, o service worker morto e `documentElement.lang ===
// 'en'`, o cartão que o `createGame` monta mostrava **«Paused», «▶ Resume», «♿ Accessibility», «🔤
// Typography»** — inglês inteiro — e anunciava-se a quem usa leitor de tela como
// **«Menu de pausa do jogador 1»**.
//
// ⚠️ QUEM PERDIA ERA SÓ QUEM ESCUTA, e é isso que torna o defeito da família que o item 4 do ADR-0044 nomeia:
// para quem vê, não havia nada a notar. O canal partido era o único canal de outra criança.
//
// 📏 E A CAUSA NÃO É STRING EM FALTA — `pause.cardAria` existe nos três dicionários. É ORDEM, a mesma que o
// `barra-no-idioma-do-arranque` já documenta: o `initI18n` aplica pt de forma síncrona e pede en/es de forma
// assíncrona, e a marcação nasce nesse intervalo. O que agrava aqui é que um `aria-label` COLADO não tem como
// ser corrigido depois: o `applyDom` só alcança `[data-i18n]` e `[data-i18n-aria]` — e o segundo não serve,
// porque chama `t(k)` SEM parâmetros e esta chave leva o número do assento. A criança ouviria as chavetas.
//
// 📌 ESTE FICHEIRO É PRÓPRIO, e a razão foi MEDIDA em vez de copiada. A primeira versão deste caso vivia no
// `barra-no-idioma-do-arranque`, e ali ele ficava VERDE com o conserto desfeito: o caso anterior daquele
// ficheiro faz `await localeReady()`, o chunk de `en` fica quente, e o cartão do segundo caso nascia já em
// inglês. O crivo estava a afirmar o conserto e a medir a ORDEM DOS CASOS. Registo de módulos limpo é o que
// faz o intervalo existir — que é o próprio sítio onde o defeito mora.
//
// ⚠️ E ELE SÓ PASSOU A IMPORTAR AGORA: até o ADR-0144 nada abria o cartão, logo ninguém o ouvia.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const CHAVE_LANG = 'incl_lang';
let anterior = null;

beforeAll(() => {
  anterior = localStorage.getItem(CHAVE_LANG);
  localStorage.setItem(CHAVE_LANG, 'en');
});
afterAll(() => {
  if (anterior === null) localStorage.removeItem(CHAVE_LANG);
  else localStorage.setItem(CHAVE_LANG, anterior);
});

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

function palco() {
  const raiz = document.createElement('div');
  raiz.innerHTML = [
    '<p id="sr-status" role="status"></p>',
    '<p id="sr-alert" role="alert"></p>',
    '<section id="game-region" tabindex="-1"></section>',
    '<div id="title-icons"></div>',
  ].join('');
  document.body.appendChild(raiz);
  return raiz;
}

describe('o cartão de pausa fala o idioma do arranque', () => {
  it('🔴 [Zero] o NOME ACESSÍVEL e o sufixo do assento saem do idioma de recuo', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { localeReady, getLocale } = await import('../app/js/core/i18n.js');
    const raiz = palco();

    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc: document, win: window, a11yBarHost: raiz.querySelector('#title-icons') },
      downloadHeavy: false,
      // ⚠️ DOIS ASSENTOS de propósito: o sufixo «· Jogador N» do título só existe em multijogador, e com um
      // jogador só o caso mediria um `<span>` vazio — que fica verde com o literal português de volta.
      players: [{ ctrl: {} }, { ctrl: {} }],
    });

    // ⚠️ O CARTÃO NASCEU NO IDIOMA DE RECUO, e afirmá-lo é metade do caso: sem esta linha, um ambiente que
    // resolvesse `en` antes da montagem faria o crivo aprovar uma engine que não conserta nada.
    const aoMontar = document.querySelector('#vp-pause-0 .pause-card')?.getAttribute('aria-label') || '';
    expect(aoMontar, 'o cartão nasceu já em inglês: este ambiente não tem o intervalo onde o defeito vive')
      .toMatch(/Menu de pausa/);

    await localeReady();
    expect(getLocale(), 'o chunk de en não carregou; o caso mediria o nada').toBe('en');

    // ⚠️ ABRIR é o que repinta: `pausa.mostrar` chama `reflectPauseIcons()`, e é lá que o nome se refaz. O
    // idioma vale no instante em que a criança abre a pausa, que é o instante certo.
    motor.pausa.mostrar(0);

    const nome = document.querySelector('#vp-pause-0 .pause-card')?.getAttribute('aria-label') || '';
    expect(nome, 'o cartão anuncia-se no idioma de recuo a quem usa leitor de tela').not.toMatch(/Menu de pausa/);
    // 📌 O PAR, pela armadilha que o ficheiro irmão já pagou: exigir «nada em português» passaria com o nome
    // VAZIO, e um diálogo sem nome acessível é pior do que um com o nome na língua errada.
    expect(nome, 'o cartão ficou SEM nome acessível').toMatch(/Player 1/);

    // 🔴 E O QUE SE VÊ, pela mesma causa e no mesmo `<h2>`: o sufixo era `' · Jogador ' + n` colado no markup
    // de um módulo de ENGINE. Em pt a chave e o literal dão a mesma string — só um arranque em `en` os separa.
    const sufixo = document.querySelector('#vp-pause-0 h2 .pause-seat')?.textContent || '';
    expect(sufixo, 'o sufixo do assento ficou em português cru').not.toMatch(/Jogador/);
    expect(sufixo, 'o sufixo do assento sumiu com dois jogadores').toMatch(/Player 1/);

    raiz.remove();
    document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-12) =====
// N1 `renomearCartao(cartao, i)` sai do `refrescarItensDaPausa`     → reprova: o nome fica em pt
// N2 o repintar escreve `''` em vez da chave                        → reprova pelo PAR (nome vazio)
// N4 o repintar do sufixo volta ao literal `' · Jogador '`          → reprova: o sufixo fica em pt
// N5 o `<span class="pause-seat">` perde o nome (alvo: `pause-icons.node`) → reprova: não há onde repintar
//
// ⚠️ E DUAS SOBREVIVERAM, ditas aqui em vez de escondidas — nenhuma delas é buraco, e saber qual é qual é o
// que distingue um plano de mutação de um ritual:
//
//   N3 pôr o literal de volta no MARKUP (e não no repintar) fica VERDE, porque o repintar o corrige antes
//      de alguém o ver. É a mesma coisa escrita duas vezes; a que vale é a que corre quando a pausa abre. O
//      valor de montagem fica traduzido na mesma porque `screenPauseMarkup` é EXPORTADO — alguém pode
//      desenhar o cartão sem a engine por perto, e aí não há repintar nenhum.
//   N6 `renomearCartao(cartao, 0)` — renumerar todos os assentos para o primeiro — fica VERDE porque esta
//      raiz monta UM cartão só (`buildScreenPause(0)`). O laço indexado existe para o dia em que montar o
//      segundo; hoje é código correcto e INERTE, e um crivo que o provasse teria de montar um cartão que a
//      engine ainda não monta.

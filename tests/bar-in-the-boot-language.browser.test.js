// SPDX-License-Identifier: AGPL-3.0-or-later
// A BARRA FALA O IDIOMA DO ARRANQUE, e não o de recuo.
//
// ========================= O DEFEITO, MEDIDO NUM NAVEGADOR ANTES DE SER ESCRITO =========================
// 🔴 Em 2026-09-08, com o `quiz.html` servido do `dist` e `documentElement.lang === 'en'`, a barra que o
// `createGame` monta servia CINCO rótulos em inglês («Blind mode (audio navigation): off») e TRÊS ainda em
// português («Webcam — rosto (em construção)»), na mesma linha de ícones.
//
// 📏 E A CAUSA NÃO É STRING EM FALTA: as três chaves (`icon.face`/`icon.eyes`/`icon.voice`) existem nos TRÊS
// dicionários. É ORDEM. O `initI18n` aplica pt de forma síncrona e pede en/es de forma ASSÍNCRONA (são chunks
// próprios); a marcação da barra nasce nesse intervalo, e depois só os rótulos COM ESTADO se corrigiam,
// porque o reflexo saltava os `soon` por uma premissa — «same string» — que deixou de ser verdade quando a
// ENGINE passou a montar a barra (ADR-0106 etapa 2).
//
// 📌 ESTE FICHEIRO É PRÓPRIO E NÃO UM CASO NO `boot-create-game.browser`, e a razão é estado de MÓDULO: o
// `core/i18n` guarda `locale`/`dict` no topo do ficheiro, e trocar o idioma vazaria para todos os outros
// casos do ficheiro que o fizesse. Aqui o registo de módulos nasce limpo.
//
// ⚠️ E ELE EXERCITA O ARRANQUE, não a troca em execução. `setLocale` depois do boot é a pergunta que o próprio
// `core/i18n` declara como sendo do Dev; o que se afirma aqui é a menor, que aquele comentário diz não ter
// duas respostas: a interface não se constrói antes de o idioma estar pronto.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
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

// A MESMA declaração do `boot-create-game.browser` — copiada e não inventada: a minha primeira versão à mão
// era malformada (`topology` como VALOR, que o ADR-0084 proibiu, e `tick` como função) e o `createGame`
// recusou-a. O contrato reprovar um fixture meu é o gate do §A a fazer o trabalho dele.
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  // Um fixture de hotspots não segura nada — o par do ADR-0115, ao lado do número que não o diz.
  holdsKeys: () => false,
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

describe('a barra da primeira tela fala o idioma do arranque', () => {
  it('🔴 [Zero] com `en` guardado, NENHUM dos oito rótulos fica no idioma de recuo', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { localeReady, getLocale } = await import('../app/js/core/i18n.js');
    const raiz = palco();

    createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc: document, win: window, a11yBarHost: raiz.querySelector('#title-icons') },
      downloadHeavy: false,
      // ⚠️ SEM `semMenuDePausa`: o campo saiu do contrato (ADR-0122). O palco TEM `#game-region`, logo o
      // cartão de pausa passa a montar-se ali — e este caso continua a medir o que media, porque conta
      // `#title-icons .pi-btn` e o cartão traz `.pm-btn` noutro hospedeiro.
      declines: { semAssistenteDePad: true, semAtorDePausa: true, semVozNeural: true },
    });

    // ⚠️ O `await` É A METADE QUE FALTAVA NO CÓDIGO, e é por isso que ele está aqui e não num `beforeEach`:
    // o defeito vive exactamente no intervalo entre montar e o dicionário chegar.
    await localeReady();
    expect(getLocale(), 'o chunk de en não carregou; o caso mediria o nada').toBe('en');

    const botoes = [...raiz.querySelectorAll('#title-icons .pi-btn')];
    expect(botoes.length, 'a barra não montou').toBeGreaterThan(0);

    const encalhados = botoes
      .map((b) => ({ k: b.dataset.pi, label: b.getAttribute('aria-label') || '' }))
      .filter((x) => /construção|desligado|ligado|Modo cego|Narração/.test(x.label));

    expect(encalhados, `ícones encalhados no idioma de recuo: ${encalhados.map((x) => `${x.k}=«${x.label}»`).join(' · ')}`)
      .toEqual([]);

    // 📌 O PAR: exigir «nada em português» passaria se os rótulos ficassem VAZIOS. Toda a barra tem de dizer
    // alguma coisa — é a mesma armadilha do gémeo silencioso do anúncio de toque.
    for (const b of botoes) {
      expect((b.getAttribute('aria-label') || '').trim().length, `${b.dataset.pi} sem rótulo`).toBeGreaterThan(0);
    }

    raiz.remove();
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08) =====
// 1. tirar o `void localeReady().then(…)` do `create-game`   → reprova, com os OITO ícones encalhados
// 2. repor o guarda `if (!…soon)` em `reflectIconBtn`         → reprova, com os TRÊS `soon` encalhados
//    🎯 é o par que mostra que as duas metades do conserto são precisas e nenhuma basta sozinha
// 3. `reflectIconsIn` a limpar o rótulo em vez de o escrever  → reprova pelo PAR (rótulo vazio), e não pela
//    regra — que é a razão de o par existir

// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-motor — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: clamp do jogador selecionado (Boundary: sel >= numPlayers), o predicado "algum jogador ativo"
// (liga a barra), o texto do anúncio de Modo Fácil e a construção das abas por jogador (mantidas `hidden`,
// decisão E3). O render()/reflect() em si (toca DOM) fica no settings-motor.browser.test.js.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { toggleLabel } from '../app/js/ui/dom.js'; // onOffLabel é alias dele desde o item 14
import { t } from '../app/js/core/i18n.js'; // os anúncios vêm do dicionário desde o item 14
import {
  easyKey, toggleRunKey, toggleMoveKey, definirAlternanciaDeMarcha,
  clampSelPlayer, anyMotorActive, onOffLabel, playerTabsHTML, easyAnnouncement,
} from '../app/js/ui/settings-motor.js';
import { KEYS } from '../app/js/platform/storage.js';

describe('easyKey', () => {
  it('[Right] gera a chave incl_easy_p{i} (== platform/storage.ts KEYS.easy_p)', () => {
    expect(easyKey(0)).toBe('incl_easy_p0');
    expect(easyKey(3)).toBe('incl_easy_p3');
  });
});

describe('clampSelPlayer', () => {
  it('[Right] mantém a seleção quando dentro do intervalo', () => {
    expect(clampSelPlayer(1, 4)).toBe(1);
    expect(clampSelPlayer(0, 1)).toBe(0);
  });
  it('[Boundary/Edge-case] volta a 0 quando a seleção é >= numPlayers (jogador saiu)', () => {
    expect(clampSelPlayer(3, 2)).toBe(0);
    expect(clampSelPlayer(2, 2)).toBe(0); // igual ao limite também clampa (índice válido é 0..numPlayers-1)
  });
  it('[Zero] numPlayers=0 sempre clampa para 0', () => {
    expect(clampSelPlayer(0, 0)).toBe(0);
  });
});

describe('anyMotorActive', () => {
  it('[Zero] nenhum jogador ativo -> false', () => {
    expect(anyMotorActive([{ easy: false, toggleMove: false }])).toBe(false);
  });
  it('[Right] true quando QUALQUER jogador tem Fácil ligado', () => {
    expect(anyMotorActive([{ easy: false, toggleMove: false }, { easy: true, toggleMove: false }])).toBe(true);
  });
  it('[Right] true quando QUALQUER jogador tem alternância ligada', () => {
    expect(anyMotorActive([{ easy: false, toggleMove: true }])).toBe(true);
  });
  it('[Boundary] lista vazia -> false (Array#some em [] é sempre false)', () => {
    expect(anyMotorActive([])).toBe(false);
  });
});

describe('onOffLabel', () => {
  it('[Interface] é o MESMO rótulo de ui/dom — o alias continua ligado à fonte única', () => {
    // O corpo daqui era uma cópia das mesmas duas palavras, com um comentário que dizia "shared" sem que
    // fosse. Virou alias de `ui/dom.toggleLabel`. O que este caso guarda não é mais o texto (isso mora em
    // tests/dom.node.test.js): é que o alias não volte a ser uma cópia.
    expect(onOffLabel).toBe(toggleLabel);
  });
});

describe('playerTabsHTML', () => {
  it('[Zero] numPlayers<=1 não gera abas (painel de 1 jogador não precisa escolher)', () => {
    expect(playerTabsHTML(1, 0)).toBe('');
    expect(playerTabsHTML(0, 0)).toBe('');
  });
  it('[Right] gera um botão por jogador com data-mp e rótulo "Jogador N"', () => {
    const html = playerTabsHTML(3, 0);
    expect(html).toContain('data-mp="0"');
    expect(html).toContain('data-mp="1"');
    expect(html).toContain('data-mp="2"');
    expect(html).toContain('Jogador 1');
    expect(html).toContain('Jogador 3');
  });
  it('[Interface] marca apenas o botão selecionado como is-on', () => {
    const html = playerTabsHTML(2, 1);
    const btn0 = html.match(/<button[^>]*data-mp="0"[^>]*>/)[0];
    const btn1 = html.match(/<button[^>]*data-mp="1"[^>]*>/)[0];
    expect(btn0).not.toContain('is-on');
    expect(btn1).toContain('is-on');
  });
});

describe('easyAnnouncement', () => {
  // Comparado contra `t()` e não contra a frase em português. Fixar a frase aqui devolveria ao teste o texto
  // que o item 14 acabou de tirar do código — e o caso continua pegando chave TROCADA, porque `t('…easyOn')`
  // e `t('…easyOff')` são diferentes.
  it('[Right] 1 jogador: sem prefixo "Jogador N"', () => {
    expect(easyAnnouncement(0, 1, true)).toBe(t('sr.motor.easyOn'));
  });
  it('[Right] multiplayer: prefixa "Jogador N: "', () => {
    expect(easyAnnouncement(1, 2, true)).toBe(t('sr.player.prefix', { n: 2 }) + t('sr.motor.easyOn'));
  });
  it('[Zero] a chave NUNCA vaza para o anúncio', () => {
    // O modo silencioso de falhar da i18n por chave: um `t()` esquecido faz o leitor de tela LER a chave.
    for (const on of [true, false]) expect(easyAnnouncement(0, 1, on)).not.toMatch(/sr\./);
  });
  it('[Boundary] desligado: mensagem curta', () => {
    expect(easyAnnouncement(0, 1, false)).toBe(t('sr.motor.easyOff'));
    expect(easyAnnouncement(2, 3, false)).toBe(t('sr.player.prefix', { n: 3 }) + t('sr.motor.easyOff'));
  });
});

describe('toggleMoveKey / a delegação das três chaves', () => {
  it('[Right] gera a chave incl_togglemove_p{i}, como as duas irmãs geram as delas', () => {
    expect(toggleMoveKey(0)).toBe('incl_togglemove_p0');
    expect(toggleMoveKey(3)).toBe('incl_togglemove_p3');
  });

  it('⚠️ [Interface] as TRÊS delegam ao `KEYS` — nenhuma voltou a ser cópia do literal', () => {
    // O `easyKey` era a última cópia deste ficheiro, e o comentário do `toggleRunKey` já registava porquê:
    // «duas cópias de um nome mudam uma de cada vez». Este caso e os pinos literais acima seguram os dois
    // lados — sozinho, ele moveria-se junto com o `KEYS`; sozinhos, os pinos deixariam a cópia voltar.
    for (const i of [0, 2]) {
      expect(easyKey(i)).toBe(KEYS.easyP(i));
      expect(toggleRunKey(i)).toBe(KEYS.toggleRunP(i));
      expect(toggleMoveKey(i)).toBe(KEYS.toggleMoveP(i));
    }
  });
});

describe('definirAlternanciaDeMarcha — a escrita que voltou para a engine (ADR-0106 §4)', () => {
  function cenario(jogadores) {
    const escrito = {};
    const ditos = [];
    return {
      escrito, ditos,
      ctx: {
        players: jogadores,
        store: { setBool: (k, on) => { escrito[k] = on; } },
        srSay: (m) => ditos.push(m),
        getNumPlayers: () => jogadores.length,
      },
    };
  }

  it('[Right] ligar escreve o campo, persiste na chave da engine e anuncia', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    definirAlternanciaDeMarcha(c.ctx, 0, true);
    expect(c.ctx.players[0].toggleMove).toBe(true);
    expect(c.escrito[KEYS.toggleMoveP(0)]).toBe(true);
    expect(c.ditos).toEqual([t('sr.motor.toggleMoveOn')]);
  });

  it('⚠️ [Right] DESLIGAR pára quem está a andar por travamento — senão a personagem anda sozinha', () => {
    // O sintoma que este caso impede não dá erro nenhum: a criança desliga o modo, larga tudo, e a
    // personagem continua a andar sem tecla nenhuma premida.
    const c = cenario([{ toggleMove: true, walkDir: -1 }]);
    definirAlternanciaDeMarcha(c.ctx, 0, false);
    expect(c.ctx.players[0].toggleMove).toBe(false);
    expect(c.ctx.players[0].walkDir).toBe(0);
    expect(c.ditos).toEqual([t('sr.motor.toggleMoveOff')]);
  });

  it('[Right] LIGAR não mexe em `walkDir` — quem já andava continua a andar', () => {
    const c = cenario([{ toggleMove: false, walkDir: 1 }]);
    definirAlternanciaDeMarcha(c.ctx, 0, true);
    expect(c.ctx.players[0].walkDir).toBe(1);
  });

  it('[Interface] com mais de um jogador, o anúncio leva o prefixo daquele assento', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }, { toggleMove: false, walkDir: 0 }]);
    definirAlternanciaDeMarcha(c.ctx, 1, true);
    expect(c.ditos).toEqual([t('sr.player.prefix', { n: 2 }) + t('sr.motor.toggleMoveOn')]);
  });

  it('[Zero] um assento que não existe não escreve, não anuncia e não rebenta', () => {
    const c = cenario([{ toggleMove: false, walkDir: 0 }]);
    definirAlternanciaDeMarcha(c.ctx, 7, true);
    expect(Object.keys(c.escrito)).toEqual([]);
    expect(c.ditos).toEqual([]);
  });
});

// ========================= MUTACOES CONFERIDAS (etapa 1b do ADR-0106) =========================
//   · ⚠️ tirando o `if (!on) p.walkDir = 0;` -> reprova "DESLIGAR para quem esta a andar". E a mutacao que
//     mais interessa: o sintoma nao da erro nenhum — a crianca desliga o modo e a personagem anda sozinha —,
//     e sem este caso a linha podia cair na mudanca de dono sem ninguem notar.
//   · trocando `if (!on)` por `if (on)` -> reprovam DOIS ("DESLIGAR para" e "LIGAR nao mexe"), que e a
//     medida de que os dois sentidos estao presos e nao so um.
//   · tirando o `if (!p) return;` -> reprova "[Zero] um assento que nao existe". Sem ele, `p.toggleMove` num
//     `undefined` lanca, e o icone da barra rapida derrubava a pausa inteira.
//   · trocando `toggleMoveKey(i)` por `easyKey(i)` na persistencia -> reprova "ligar escreve ... na chave da
//     engine". Sem esse caso, escrever na chave errada perderia o ajuste E estragaria o modo facil, calado.
//   · trocando o ternario do anuncio (`on ? …On : …Off`) -> reprovam DOIS, um por sentido.
//   · devolvendo `easyKey` ao literal `'incl_easy_p' + i` -> ⚠️ NAO reprova, e isso esta certo: a copia e o
//     literal coincidem hoje. O que reprova e mudar `KEYS.easyP` — ai o pino literal cai. Os dois casos
//     juntos e que seguram os dois lados; e por isso que nenhum deles sozinho bastava.

// SPDX-License-Identifier: AGPL-3.0-or-later
// AS TRÊS CENAS DESTE JOGO (game/cenas) — as regras de ir de uma para a outra, sem documento nenhum.
//
// ========================= POR QUE ESTE ARQUIVO EXISTE =========================
// Estas regras eram do `ui/shell` e tinham caso em `tests/shell.browser.test.js`. Ao tirar `phase` de
// `core/state` (ADR-0030 C3), a troca de cena ia parar na RAIZ DE COMPOSIÇÃO — que não é importável. Três
// garantias teriam sumido em silêncio, e uma delas é a única que o `phase` nunca soube dizer.
//
// Por isso as regras foram para `game/cenas`, do lado do jogo (o vocabulário é dele) e ainda testável.
//
// ========================= A GARANTIA QUE O ENUM NÃO SABIA DAR =========================
// `phase === 'paused'` APAGAVA a informação de que há um jogo por baixo. A pilha a mantém — e é dela que
// sai, sem ninguém escrever, "o mundo continua desenhado mas não recebe tempo". É por isso que os casos
// abaixo afirmam `nomes()`, e não só os três booleanos: os booleanos escondem exatamente o que a pilha
// acrescenta.
//
// As MUTAÇÕES CONFERIDAS estão no fim do arquivo.
import { describe, it, expect } from 'vitest';
import { criarCenasDoJogo } from '../app/js/game/cenas.js';

describe('game/cenas — onde o jogo começa', () => {
  it('[Zero] nasce no título, e é o único fato verdadeiro', () => {
    const c = criarCenasDoJogo();
    expect(c.fatos()).toEqual({ telaDeTitulo: true, mundoRodando: false, menuDePausa: false });
    expect(c.nomes()).toEqual(['titulo']);
    expect(c.fase()).toBe('title');
  });
});

describe('game/cenas — irPara', () => {
  it('[Right] título → jogo TROCA a cena; não sobra título embaixo', () => {
    const c = criarCenasDoJogo();
    c.irPara('playing');
    expect(c.nomes()).toEqual(['jogo']);
    expect(c.fatos().mundoRodando).toBe(true);
  });

  it('[Right] pausar EMPILHA — o jogo continua na pilha, que é o que o enum não dizia', () => {
    const c = criarCenasDoJogo();
    c.irPara('playing');
    c.irPara('paused');
    expect(c.nomes()).toEqual(['jogo', 'pausa']);
    expect(c.fatos()).toEqual({ telaDeTitulo: false, mundoRodando: false, menuDePausa: true });
  });

  it('[Inverse] sair da pausa DESEMPILHA — e o jogo de baixo é o MESMO objeto, não um recomeço', () => {
    // A diferença importa: `replace` daria uma cena `jogo` NOVA, e um dia, quando as cenas tiverem corpo,
    // isso seria o mundo remontando toda vez que a criança despausasse.
    const c = criarCenasDoJogo();
    c.irPara('playing');
    const jogo = c.pilha.top();
    c.irPara('paused');
    c.irPara('playing');
    expect(c.nomes()).toEqual(['jogo']);
    expect(c.pilha.top()).toBe(jogo);
  });

  it('[Idempotent] pedir a cena em que já se está não empilha de novo', () => {
    const c = criarCenasDoJogo();
    c.irPara('playing'); c.irPara('paused'); c.irPara('paused'); c.irPara('paused');
    expect(c.nomes()).toEqual(['jogo', 'pausa']);
  });

  it('[Right] do meio da pausa dá para ir direto ao título, sem passar pelo jogo', () => {
    // É o "Sair" do menu de pausa. Sem o desempilhar antes do replace, sobraria um `jogo` órfão embaixo.
    const c = criarCenasDoJogo();
    c.irPara('playing'); c.irPara('paused');
    c.irPara('title');
    expect(c.nomes()).toEqual(['titulo']);
  });

  it('[Interface] avisa DEPOIS de a pilha já ter mudado — quem projeta vê o estado novo', () => {
    // A ordem é a garantia: a casca é chamada para desenhar a cena que ENTROU, não a que saiu.
    const vistos = [];
    const c = criarCenasDoJogo(() => vistos.push(c.fase()));
    c.irPara('playing');
    c.irPara('paused');
    expect(vistos).toEqual(['playing', 'paused']);
  });
});

describe('game/cenas — alternarPausa', () => {
  it('[Right] jogando → pausado → jogando', () => {
    const c = criarCenasDoJogo();
    c.irPara('playing');
    c.alternarPausa();
    expect(c.fase()).toBe('paused');
    c.alternarPausa();
    expect(c.fase()).toBe('playing');
  });

  it('[Zero] no título NÃO faz nada — nem avisa quem projeta', () => {
    // Verbatim do `else if` sem `else` do original. E o "nem avisa" é o que impede a casca de repintar o
    // documento por uma tecla que não fez nada.
    const vistos = [];
    const c = criarCenasDoJogo(() => vistos.push(c.fase()));
    c.alternarPausa();
    expect(c.fase()).toBe('title');
    expect(c.nomes()).toEqual(['titulo']);
    expect(vistos).toEqual([]);
  });

  it('[Boundary] numa cena que este jogo ainda não tem, também não faz nada', () => {
    // A pilha aceita qualquer cena (é o ponto do ADR-0030 C3). Um mapa de fases empilhado por cima não pode
    // virar "pausa" por acidente só porque alguém apertou Escape.
    const c = criarCenasDoJogo();
    c.irPara('playing');
    c.pilha.push({ nome: 'mapa' });
    c.alternarPausa();
    expect(c.nomes()).toEqual(['jogo', 'mapa']);
    expect(c.fatos()).toEqual({ telaDeTitulo: false, mundoRodando: false, menuDePausa: false });
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
// Cada uma foi aplicada em `app/js/game/cenas.ts`, o caso foi visto VERMELHO com a mensagem anotada, e a
// mutação foi desfeita:
//
//   · `pilha.push({ nome: NOME.paused })` → `pilha.replace(...)`
//       → "[Right] pausar EMPILHA": expected [ 'pausa' ] to deeply equal [ 'jogo', 'pausa' ]
//   · tirar o `if (topo === NOME.paused) pilha.pop();` (sair da pausa deixa de desempilhar)
//       → "[Inverse] sair da pausa DESEMPILHA": expected [ 'jogo', 'jogo' ] to deeply equal [ 'jogo' ]
//   · em `alternarPausa`, trocar o `else if (f.menuDePausa)` por um `else` seco
//       → "[Zero] no título NÃO faz nada": expected 'playing' to be 'title'
//   · chamar `aoTrocar?.()` ANTES de mexer na pilha
//       → "[Interface] avisa DEPOIS": expected [ 'title', 'playing', … ] to deeply equal [ 'playing', 'paused' ]

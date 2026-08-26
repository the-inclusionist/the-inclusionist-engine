// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/run-state — o estado da RODADA como fábrica (ADR-0038, Fase B; project node).
//
// O caso que dá sentido ao arquivo é o do VAZAMENTO. A D13 do `inclusionist-demos` proíbe estado de módulo na
// engine, e o motivo é concreto: a casca de lá carrega jogo após jogo NA MESMA PÁGINA. Com `export let`, o
// portão que ficou aberto no jogo anterior continua aberto no seguinte — a menos que alguém se lembre de
// zerar, e "alguém se lembra" não é mecanismo.
//
// Os outros casos existem para que este não passe por acidente.
import { describe, it, expect } from 'vitest';
import { createRunState } from '../app/js/core/run-state.js';

/** O que `game/level-geometry.computeExtras()` devolve, na forma que a fábrica recebe. */
const extras = (over = {}) => ({
  powerups: over.powerups ?? [{ kind: 'chave' }, { kind: 'super' }],
  gateTiles: over.gateTiles ?? new Set(['29,36', '30,36']),
  gate: over.gate ?? [{ tx: 29, ty: 36 }, { tx: 30, ty: 36 }],
  gateOpen: over.gateOpen ?? false,
});

describe('createRunState — a rodada nasce zerada', () => {
  it('sem nível montado: sem power-up, sem portão, e o portão AUSENTE conta como aberto', () => {
    const r = createRunState();
    expect(r.powerups).toEqual([]);
    expect(r.gate).toBeNull();
    expect(r.gateTiles.size).toBe(0);
    expect(r.wcSolid.size).toBe(0);
    // `true` e não `false`: "fechado" significa que os tiles do portão são SÓLIDOS, e um nível sem portão
    // nenhum não pode ter sólidos invisíveis. O padrão errado aqui muraria o mapa.
    expect(r.gateOpen).toBe(true);
  });
});

describe('createRunState — o vazamento que a D13 existe para impedir', () => {
  it('DUAS rodadas não compartilham nada: o portão aberto numa não abre a outra', () => {
    const a = createRunState();
    const b = createRunState();
    a.setLevelExtras(extras({ gateOpen: false }));
    a.setGateOpen(true);
    a.setWcSolid(new Set(['5,5']));

    expect(b.gateOpen).toBe(true);      // b nunca foi tocada
    expect(b.powerups).toEqual([]);
    expect(b.gate).toBeNull();
    expect(b.gateTiles.size).toBe(0);
    expect(b.wcSolid.size).toBe(0);
  });

  it('e os conjuntos não são o MESMO objeto — senão um `.add()` numa apareceria na outra', () => {
    const a = createRunState(), b = createRunState();
    expect(a.gateTiles).not.toBe(b.gateTiles);
    expect(a.wcSolid).not.toBe(b.wcSolid);
    expect(a.powerups).not.toBe(b.powerups);
  });
});

describe('createRunState — os extras entram JUNTOS', () => {
  it('um setter só grava os quatro, que é como o nível os produz', () => {
    const r = createRunState();
    const x = extras();
    r.setLevelExtras(x);
    expect(r.powerups).toBe(x.powerups);
    expect(r.gateTiles).toBe(x.gateTiles);
    expect(r.gate).toBe(x.gate);
    expect(r.gateOpen).toBe(false);
  });

  it('montar outro nível SUBSTITUI tudo — não sobra tile do anterior', () => {
    // É o mesmo vazamento do caso acima, dentro de uma rodada só: reiniciar precisa mesmo REINICIAR.
    const r = createRunState();
    r.setLevelExtras(extras());
    r.setLevelExtras({ powerups: [], gateTiles: new Set(), gate: null, gateOpen: true });
    expect(r.powerups).toEqual([]);
    expect(r.gate).toBeNull();
    expect(r.gateTiles.size).toBe(0);
    expect(r.gateOpen).toBe(true);
  });

  it('`setLevelExtras` NÃO mexe no `wcSolid`: ele não nasce com os outros quatro', () => {
    // A geometria de cadeirante é recalculada quando o modo liga/desliga, não quando o nível monta. Se um
    // dia ela entrar no mesmo setter, este caso avisa que a assinatura passou a mentir sobre o momento.
    const r = createRunState();
    r.setWcSolid(new Set(['7,7']));
    r.setLevelExtras(extras());
    expect(r.wcSolid.has('7,7')).toBe(true);
  });
});

describe('createRunState — o portão durante a rodada', () => {
  it('abre e fecha sem tocar no resto', () => {
    const r = createRunState();
    const x = extras({ gateOpen: false });
    r.setLevelExtras(x);
    r.setGateOpen(true);
    expect(r.gateOpen).toBe(true);
    expect(r.gateTiles).toBe(x.gateTiles); // os tiles continuam lá: fechar de novo tem o que solidificar
    expect(r.gate).toBe(x.gate);
  });
});

/* ---------- os cinco campos que chegaram de core/state (Fase B, fatia 2) ----------

   A cobertura veio junto com o estado; nenhum caso foi apagado. E ganhou um que em `core/state` era
   IMPOSSÍVEL escrever: o do vazamento entre duas rodadas, porque lá só existia uma. */

describe('selVizPlayer — qual jogador os painéis visuais editam', () => {
  it('[Zero] começa em 0 — o jogador 1 edita antes de alguém escolher', () => {
    expect(createRunState().selVizPlayer).toBe(0);
  });
  it('[Right] o setter escreve', () => {
    const r = createRunState();
    r.setSelVizPlayer(1); expect(r.selVizPlayer).toBe(1);
    r.setSelVizPlayer(0); expect(r.selVizPlayer).toBe(0);
  });
  it('[Leak] duas rodadas editam jogadores diferentes sem se atrapalhar', () => {
    const a = createRunState(), b = createRunState();
    a.setSelVizPlayer(3);
    expect(b.selVizPlayer).toBe(0);
  });
});

describe('pauseActor — quem abriu a pausa define o ESCOPO do menu', () => {
  it('[Zero] começa em 0', () => { expect(createRunState().pauseActor).toBe(0); });
  it('[Right] o setter escreve', () => {
    const r = createRunState();
    r.setPauseActor(2); expect(r.pauseActor).toBe(2);
  });
  it('[Leak] a pausa de uma rodada não define o escopo da outra', () => {
    // Em telas separadas este índice é o que faz o menu do jogador 2 editar os ajustes DELE. Errar aqui não
    // dá erro: dá a criança certa mexendo nas configurações da errada, em silêncio.
    const a = createRunState(), b = createRunState();
    a.setPauseActor(1);
    expect(b.pauseActor).toBe(0);
  });
});

describe('flora — densidade da grama e semente do decor', () => {
  // O CLAMP é o motivo de o setter existir. Ele morava no `__incl`, ou seja, protegia só quem entrasse por
  // ali; qualquer outro caminho podia escrever 5 ou -1 e o cenário nascia errado sem nada reclamar.
  it('[Right] aceita a faixa 0..1 inteira', () => {
    const r = createRunState();
    for (const v of [0, 0.6, 1]) { r.setGrassDensity(v); expect(r.grassDensity).toBe(v); }
  });
  it('[Boundary] prende acima de 1 e abaixo de 0, em vez de gerar um cenário impossível', () => {
    const r = createRunState();
    r.setGrassDensity(5); expect(r.grassDensity).toBe(1);
    r.setGrassDensity(-1); expect(r.grassDensity).toBe(0);
  });
  it('[Zero/Error] lixo vira 0, não NaN — NaN atravessaria o clamp e envenenaria o desenho', () => {
    const r = createRunState();
    r.setGrassDensity(Number('abc'));
    expect(r.grassDensity).toBe(0);
  });
  it('[Right] a semente é inteira sem sinal — é assim que o gerador a consome', () => {
    const r = createRunState();
    r.setDecorSeed(1234567890); expect(r.decorSeed).toBe(1234567890);
    r.setDecorSeed(-1); expect(r.decorSeed).toBe(4294967295); // >>> 0
  });
  it('[Leak] a semente de uma rodada não vira a grama da outra', () => {
    // A semente é sorteada por fase DE PROPÓSITO: é o que faz duas partidas da mesma fase não terem a mesma
    // grama. Compartilhá-la entre rodadas apagaria essa variedade sem ninguém notar o porquê.
    const a = createRunState(), b = createRunState();
    a.setDecorSeed(42);
    expect(b.decorSeed).toBe(0);
  });
});

describe('ended — a rodada acabou', () => {
  it('[Zero] nasce falso, e o setter normaliza para booleano', () => {
    const r = createRunState();
    expect(r.ended).toBe(false);
    r.setEnded(1); expect(r.ended).toBe(true);
    r.setEnded(0); expect(r.ended).toBe(false);
  });
  it('[Leak] a vitória de uma rodada NÃO encerra a outra', () => {
    // É o vazamento mais caro dos cinco: numa casca que troca de jogo, herdar `ended` faria o próximo jogo
    // nascer travado — o laço de atualização faz `if (ended) return;` e nada se mexeria.
    const a = createRunState(), b = createRunState();
    a.setEnded(true);
    expect(b.ended).toBe(false);
  });
});

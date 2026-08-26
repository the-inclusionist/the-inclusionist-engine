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

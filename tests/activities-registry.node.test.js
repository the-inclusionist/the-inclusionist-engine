// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de educational/activities-registry — catálogo de atividades + validação de id (project node). ZOMBIES + Right-BICEP.
// Puro (sem DOM/PIXI). Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, ACTIVITIES).
import { describe, it, expect } from 'vitest';
import {
  getActivity, hasActivity, isValidActivityId, listActivities, listActivityIds, DEFAULT_ACTIVITY_ID,
} from '../app/js/educational/activities-registry.js';

describe('DEFAULT_ACTIVITY_ID', () => {
  it('é "ludico" e existe no catálogo', () => {
    expect(DEFAULT_ACTIVITY_ID).toBe('ludico');
    expect(isValidActivityId(DEFAULT_ACTIVITY_ID)).toBe(true);
  });
});

describe('isValidActivityId / hasActivity', () => {
  it('true para id conhecido de cada categoria', () => {
    expect(isValidActivityId('ludico')).toBe(true);
    expect(isValidActivityId('alf3')).toBe(true);
    expect(isValidActivityId('mat5')).toBe(true);
    expect(isValidActivityId('fr632')).toBe(true);
  });
  it('false para id desconhecido, string vazia e id de outra atividade parecido', () => {
    expect(isValidActivityId('nao-existe')).toBe(false);
    expect(isValidActivityId('')).toBe(false);
    expect(isValidActivityId('alf6')).toBe(false); // só existem alf1..alf5
  });
  it('hasActivity é sinônimo de isValidActivityId (mesma resposta)', () => {
    expect(hasActivity('mat6')).toBe(isValidActivityId('mat6'));
    expect(hasActivity('xyz')).toBe(isValidActivityId('xyz'));
  });
});

describe('getActivity', () => {
  it('id conhecido devolve a definição com os campos certos', () => {
    const a = getActivity('alf1');
    expect(a).toBeDefined();
    expect(a.cat).toBe('alf');
    expect(a.nome).toBe('Descobrindo palavras');
    expect(a.sub).toBe('BABA • BOLA • BEBE');
  });
  it('id desconhecido devolve undefined (chamador decide o fallback)', () => {
    expect(getActivity('nao-existe')).toBeUndefined();
  });
  it('atividade "pick" (Tabuada/Divisão) expõe pick:true', () => {
    expect(getActivity('mat5').pick).toBe(true);
    expect(getActivity('mat6').pick).toBe(true);
    expect(getActivity('mat1').pick).toBeUndefined();
  });
  it('atividade de fração expõe dens (denominadores treinados)', () => {
    expect(getActivity('fr2').dens).toEqual([2]);
    expect(getActivity('fr632').dens).toEqual([6, 3, 2]);
    expect(getActivity('mat1').dens).toBeUndefined();
  });
  it('ludico não tem d nem sub (só cat + nome)', () => {
    const a = getActivity('ludico');
    expect(a.cat).toBe('ludico');
    expect(a.nome).toBe('Coletar 10 moedas');
    expect(a.d).toBeUndefined();
    expect(a.sub).toBeUndefined();
  });
});

describe('listActivityIds / listActivities', () => {
  it('lista todos os 18 ids do catálogo, sem repetição', () => {
    const ids = listActivityIds();
    expect(ids.length).toBe(18);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('inclui os ids esperados de cada categoria', () => {
    const ids = listActivityIds();
    expect(ids).toContain('ludico');
    expect(ids).toEqual(expect.arrayContaining(['alf1', 'alf2', 'alf3', 'alf4', 'alf5']));
    expect(ids).toEqual(expect.arrayContaining(['mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'mat6']));
    expect(ids).toEqual(expect.arrayContaining(['fr2', 'fr3', 'fr42', 'fr5', 'fr632', 'fr2a6']));
  });
  it('listActivities devolve pares [id, def] na mesma ordem de listActivityIds', () => {
    const pairs = listActivities();
    expect(pairs.map(([id]) => id)).toEqual(listActivityIds());
    const [firstId, firstDef] = pairs[0];
    expect(firstId).toBe('ludico');
    expect(firstDef).toBe(getActivity('ludico'));
  });
  it('a mesma referência de objeto sai em getActivity e em listActivities (sem cópia por chamada)', () => {
    const fromGet = getActivity('mat3');
    const fromList = listActivities().find(([id]) => id === 'mat3')[1];
    expect(fromGet).toBe(fromList);
  });
});

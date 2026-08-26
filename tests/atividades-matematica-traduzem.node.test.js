// SPDX-License-Identifier: AGPL-3.0-or-later
// MATEMÁTICA TRADUZ; ALFABETIZAÇÃO NÃO — e o catálogo estava aplicando a exceção às duas.
//
// ========================= O ACHADO =========================
// O Dev abriu os menus de matemática num build em inglês e viu itens em português. A causa estava escrita, em
// letras grandes, no cabeçalho do próprio `educational/activities-registry`:
//
//   "NÃO SE TRADUZ. Pilar 3 (ADR-0010): currículo de alfabetização se REESCREVE por idioma, não se traduz —
//    a psicogênese de Ferreiro é sobre a escrita do PORTUGUÊS."
//
// A frase está certa e a aplicação estava errada: ela vale para ALFABETIZAÇÃO, e o módulo a aplicava ao
// catálogo inteiro. O CLAUDE.md diz o contrário com todas as letras — "⚠️ Matemática NÃO é disciplina de
// idioma. `2 + 3` independe de língua, então 'Quanto é 2 mais 3?' é enunciado e traduz inteiro".
//
// É a exceção comendo a regra: uma isenção legítima e estreita virou o comportamento padrão porque ninguém
// mediu onde ela terminava. "Tabuada", "Divisão", "Quantidade" e as seis frações não são conteúdo
// linguístico — são o nome de uma operação que existe igual em qualquer língua.
//
// ========================= COMO A LINHA FICA MEDÍVEL =========================
// A distinção não pode morar na cabeça de quem escreve a próxima atividade. Aqui ela vira mecânica: entrada
// de `cat: 'alf'` NÃO declara chave de i18n (é a matéria); qualquer outra DECLARA. Um catálogo novo que
// esqueça a chave reprova, e um que traduza a alfabetização também.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listActivities, getActivity } from '../app/js/educational/activities-registry.js';
import { nomeDaAtividade, descricaoDaAtividade } from '../app/js/ui/activities-menu.js';

const dicionario = (lang) => {
  const src = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', lang + '.ts'), 'utf8');
  const out = {};
  for (const m of src.matchAll(/['"]?([\w.$-]+)['"]?\s*:\s*(['"])((?:\\.|(?!\2).)*)\2/g)) out[m[1]] = m[3];
  return out;
};
const PT = dicionario('pt'), EN = dicionario('en'), ES = dicionario('es');

const todas = () => listActivities();
const alfabetizacao = () => todas().filter(([, a]) => a.cat === 'alf');
const traduziveis = () => todas().filter(([, a]) => a.cat !== 'alf');

describe('catálogo de atividades · a fronteira currículo × moldura, medida', () => {
  it('[Zero] o gate está lendo o catálogo e os dicionários de verdade', () => {
    expect(todas().length).toBeGreaterThanOrEqual(18);
    expect(alfabetizacao().length).toBe(5);
    expect(Object.keys(PT).length).toBeGreaterThan(300);
  });

  it('[Right] toda atividade que NÃO é de alfabetização declara chave de i18n', () => {
    const semChave = traduziveis()
      .filter(([, a]) => !a.nomeKey || (a.d && !a.dKey))
      .map(([id]) => id);
    expect(semChave, 'atividade traduzível sem chave — ela vai CRUA para o menu: ' + semChave.join(', ')).toEqual([]);
  });

  it('[Right] as chaves existem nos TRÊS idiomas, e o inglês não é cópia do português', () => {
    // A segunda metade é o que impede o conserto de teatro: declarar a chave e preencher os três dicionários
    // com o mesmo pt-BR deixaria este gate verde e a tela igualmente em português.
    const problemas = [];
    for (const [id, a] of traduziveis()) {
      for (const k of [a.nomeKey, a.dKey].filter(Boolean)) {
        if (!(k in PT)) problemas.push(id + ': ' + k + ' falta em pt');
        if (!(k in EN)) problemas.push(id + ': ' + k + ' falta em en');
        if (!(k in ES)) problemas.push(id + ': ' + k + ' falta em es');
        if (EN[k] && EN[k] === PT[k]) problemas.push(id + ': ' + k + ' em inglês é o português copiado');
      }
    }
    expect(problemas, problemas.join(' | ')).toEqual([]);
  });

  it('[Boundary] a ALFABETIZAÇÃO continua sem chave — ela é a matéria, não a moldura', () => {
    // O caso que impede o conserto de atravessar a fronteira. As palavras, sílabas e celas Braille são o
    // CONTEÚDO de uma atividade sobre a escrita do português; traduzi-las trocaria a matéria pela sombra dela.
    const traduzidas = alfabetizacao().filter(([, a]) => a.nomeKey || a.dKey).map(([id]) => id);
    expect(traduzidas, 'atividade de alfabetização com chave de tradução: ' + traduzidas.join(', ')).toEqual([]);
  });

  it('[Interface] os resolvedores usam a chave quando ela existe e o texto cru quando não', () => {
    expect(nomeDaAtividade(getActivity('mat5'))).toBe(PT['act.mat5.nome']);
    expect(descricaoDaAtividade(getActivity('mat5'))).toBe(PT['act.mat5.d']);
    expect(nomeDaAtividade(getActivity('alf1'))).toBe('Descobrindo palavras'); // sem chave: o cru é a resposta
  });

  it('[Zero] resolver uma atividade inexistente não estoura', () => {
    expect(nomeDaAtividade(undefined)).toBe('');
    expect(descricaoDaAtividade(null)).toBe('');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando `nomeKey` de `mat5` → "[Right] toda atividade que NÃO é de alfabetização" reprova nomeando mat5.
//   · pondo `nomeKey: 'act.alf1.nome'` em `alf1` → "[Boundary] a ALFABETIZAÇÃO continua sem chave" reprova.
//   · copiando o pt para o `act.mat5.nome` do en.ts → "[Right] o inglês não é cópia do português" reprova.

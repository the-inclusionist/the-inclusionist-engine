// SPDX-License-Identifier: AGPL-3.0-or-later
// A INSTRUÇÃO FALADA TEM DE DIZER O BOTÃO CERTO — e a alternância do correr trocou o botão.
//
// ========================= O DEFEITO QUE ISTO FECHA, E ELE É MEU =========================
// Eu migrei o gatilho de grudar na parede do Correr para o Pulo quando a alternância do correr está ligada, e
// deixei para trás as duas frases que a criança OUVE sobre esse poder:
//
//   sr.power.wallcling  — "Escalada (aranha)! No ar, aperte CORRER perto de uma parede/teto para grudar;
//                          engatinha e contorna quinas; CORRER de novo solta."
//   sr.physics.spiderOn — "Modo aranha! Engatinha em paredes e teto; contorna quinas. CORRER solta."
//
// Com a alternância ligada, as duas mandam apertar um botão que agora faz outra coisa — liga e desliga a
// corrida. Quem enxerga descobre experimentando; quem não enxerga tem NESSA FRASE o único canal, e ele
// passou a apontar para o lugar errado.
//
// É a armadilha do ADR-0044 na forma mais pura: a única informação que aquela criança tem, errada.
//
// ========================= A FORMA DO CONSERTO =========================
// O nome do botão vira `{botao}` e atravessa por parâmetro — "a moldura mora na chave, o conteúdo atravessa
// por `{param}`", que é a regra que este projeto já usa para currículo e para o slot de toque. Uma frase só
// nos três idiomas, e o nome varia com o ajuste.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

describe('instrução falada · o botão dito é o botão que funciona', () => {
  it('[Right] a instrução do grude manda apertar o BOTÃO DE INTERAÇÃO, e só ele', () => {
    // Havia dois casos aqui, um por botão, porque o contrato de 27/08 movia o grude para o pulo com a
    // alternância ligada. O Dev revogou, e `botaoDeGrude` foi embora: não há mais escolha a fazer. O que
    // continua importando é que a frase CARREGUE o parâmetro — sem ele, ela volta a nomear um botão à mão.
    for (const [idioma, dic] of [['pt', pt], ['en', en], ['es', es]]) {
      expect(dic['sr.physics.spiderOn'], `${idioma}: a moldura tem de trazer {botao}`).toContain('{botao}');
      expect(dic['sr.power.wallcling'], `${idioma}: idem`).toContain('{botao}');
    }
  });

  it('[Right] as duas frases do poder de aranha carregam `{botao}` nos TRÊS idiomas', () => {
    // Sem o parâmetro, o nome do botão estaria embutido no texto e cada idioma teria de reescrever a frase
    // inteira para trocá-lo — que é exatamente como o defeito nasceu.
    for (const [nome, d] of [['pt', pt], ['en', en], ['es', es]]) {
      for (const k of ['sr.power.wallcling', 'sr.physics.spiderOn']) {
        expect(d[k], `${nome} não tem ${k}`).toBeTruthy();
        expect(d[k], `${nome}/${k} deixou de carregar {botao}`).toContain('{botao}');
      }
    }
  });

  it('[Zero] nenhuma das duas frases menciona o botão POR NOME — senão a troca não alcança', () => {
    // O caso que impede o conserto pela metade: pôr `{botao}` numa ocorrência e deixar a outra escrita à mão
    // faria a frase dizer os DOIS botões, um certo e um errado.
    for (const [nome, d] of [['pt', pt], ['en', en], ['es', es]]) {
      for (const k of ['sr.power.wallcling', 'sr.physics.spiderOn']) {
        expect(d[k].toLowerCase(), `${nome}/${k} ainda nomeia um botão à mão`).not.toMatch(/correr|\brun\b|pular|\bjump\b/);
      }
    }
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o `{botao}` de uma das duas frases → o caso acima reprova, e o efeito real é a
//     criança cega apertando o botão que liga a corrida enquanto tenta grudar na parede.
//   · devolvendo "Correr" escrito à mão numa das ocorrências de `{botao}` → "[Zero] nenhuma das duas
//     menciona o botão por nome" reprova.

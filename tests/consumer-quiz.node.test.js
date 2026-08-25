// SPDX-License-Identifier: GPL-3.0-or-later
// O SEGUNDO CONSUMIDOR — lógica pura (project node). ADR-0027 passo 6, antecipado pelo Dev em 2026-08-25.
//
// Este arquivo tem uma função que os outros testes não têm: ele é parte do INSTRUMENTO. O consumidor existe
// para medir a fronteira engine↔jogo, e um consumidor que não é testado nem construído não mede nada — vira
// uma pasta com boas intenções, que é exatamente o que o ADR diz que "engine" vira sem ele.
//
// O caso mais importante daqui não é sobre quiz nenhum: é o que afere que este módulo NÃO IMPORTA DE `game/`.
// É a regra inteira do experimento, e sem ela a primeira pressa a desfaz sem que ninguém perceba.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { perguntaHtml, proximoFoco, respostaTexto } from '../app/js/consumer-quiz/main-quiz.js';

const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'consumer-quiz', 'main-quiz.ts'), 'utf8');

describe('o consumidor obedece à própria regra', () => {
  it('[Right] NÃO importa de game/ — é a regra que faz dele um instrumento e não um jogo a mais', () => {
    expect(FONTE).not.toMatch(/from '\.\.\/game\//);
  });

  it('[Interface] e também não importa PIXI: quem não desenha mundo não paga 467 kB por isso', () => {
    // Não é economia, é a medida. Se o quiz precisasse da PIXI para usar a pilha de acessibilidade, essa
    // pilha estaria amarrada ao renderizador do jogo de plataforma — e o pilar 2 valeria só dentro do gênero.
    expect(FONTE).not.toMatch(/from 'pixi\.js'|@pixi/);
  });

  it('[Interface] importa de core/ — a camada de a11y é alcançável sem trazer o jogo junto', () => {
    expect(FONTE).toMatch(/from '\.\.\/core\/a11y-sr\.js'/);
    expect(FONTE).toMatch(/from '\.\.\/core\/i18n\.js'/);
  });
});

describe('proximoFoco — a regra que o teclado e o pad compartilham', () => {
  it('[Right] anda para frente e para trás', () => {
    expect(proximoFoco(0, 1, 4)).toBe(1);
    expect(proximoFoco(2, -1, 4)).toBe(1);
  });

  it('[Boundary] dá a volta nas duas pontas', () => {
    // Dar a volta não é conveniência: quem navega só por teclado ou por UM botão não tem como "voltar" de
    // outro jeito, e uma lista que trava na ponta deixa a última alternativa inalcançável para essa criança.
    expect(proximoFoco(3, 1, 4)).toBe(0);
    expect(proximoFoco(0, -1, 4)).toBe(3);
  });

  it('[Zero] lista vazia devolve 0 em vez de NaN', () => {
    expect(proximoFoco(0, 1, 0)).toBe(0);
    expect(proximoFoco(2, -1, 0)).toBe(0);
  });
});

describe('respostaTexto — o que a criança cega RECEBE', () => {
  it('[Right] o acerto e o erro dizem coisas diferentes, e o erro DIZ A RESPOSTA', () => {
    // Um "ainda não" sem a resposta certa deixa a criança sem o que aprender com o erro — e quem depende do
    // leitor de tela não pode simplesmente olhar a tela para descobrir.
    expect(respostaTexto(true, 'Galinha')).toContain('Certo');
    expect(respostaTexto(false, 'Galinha')).toContain('Galinha');
  });
});

describe('perguntaHtml — a marcação', () => {
  const p = { enunciado: 'Quantos?', alternativas: ['Um', 'Dois'], certa: 1 };

  it('[Right] cada alternativa é um rádio com estado, não um botão mudo', () => {
    const html = perguntaHtml(p, 1);
    expect(html).toMatch(/role="radiogroup"/);
    expect(html).toMatch(/data-alt="1"[^>]*aria-checked="true"/);
    expect(html).toMatch(/data-alt="0"[^>]*aria-checked="false"/);
  });

  it('[Zero] sem alternativas, ainda monta o enunciado sem quebrar', () => {
    expect(perguntaHtml({ enunciado: 'Vazio?', alternativas: [], certa: 0 }, 0)).toContain('Vazio?');
  });
});

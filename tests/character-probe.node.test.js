// SPDX-License-Identifier: AGPL-3.0-or-later
// A SONDA DO PERSONAGEM — o instrumento que o "kage bunshin" pediu, e por que ele mora no painel de debug.
//
// ========================= O PROBLEMA QUE ELA RESOLVE =========================
// O Dev relatou várias cópias do personagem em posições diferentes durante o pulo e o idle. Eu descartei, por
// medição, quatro causas — sprite órfão na cena, recorte errado no atlas (39 quadros conferidos contra a
// origem, zero divergência), acúmulo de textura de render (só existe com 2+ jogadores) e a barra de
// acessibilidade. O que sobrou mora nos quadros em movimento, e é ali que eu não chego: o meu ambiente não
// desenha a tela, e a tela é dele.
//
// A sonda existe para que a MEDIÇÃO ande até onde eu não ando. Ela grava alguns segundos de quadros e reduz
// tudo a três perguntas que separam as causas restantes:
//
//   · quantas TEXTURAS distintas apareceram, e qual o recorte de cada uma — uma base maior que o recorte é
//     sangramento de atlas (o personagem aparece com os vizinhos dentro do próprio quadro);
//   · algum IRMÃO da câmera desenhou o personagem junto — é o caso de alguém desenhando duas vezes;
//   · quais ESCALAS apareceram — o squash & stretch mexe nelas, e uma escala doida deforma sem duplicar.
//
// Se as três vierem limpas, a causa é de composição (pós-efeito, filtro, câmera) e não do sprite — e isso
// também é resposta.
//
// ========================= POR QUE UM RESUMO, E NÃO O BRUTO =========================
// 180 quadros de dados brutos num painel é um muro de números que ninguém lê, e no console é pior: o Dev
// pediu explicitamente que a sonda fosse PARA DENTRO do painel. O que ele precisa ler são três linhas.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { summariseProbe } from '../app/js/ui/debug-panel.js';

/** Uma amostra limpa: um recorte que ocupa a base inteira, sem irmãos. */
const limpa = (tex, pos) => ({
  textureId: tex, crop: '0,0 26x35', base: '26x35', position: pos, scale: '1.00,1.00',
  siblingsDrawing: 0, siblingPositions: '',
});

describe('sonda do personagem · o resumo que separa as causas', () => {
  it('[Zero] sem amostras, diz que não gravou nada — e não inventa diagnóstico', () => {
    const r = summariseProbe([]);
    expect(r.frames).toBe(0);
    expect(r.verdict).toContain('nada');
  });

  it('[Right] quadros limpos → nenhum suspeito, e o veredito diz onde procurar em seguida', () => {
    const as = [limpa(0, '10,20'), limpa(1, '10,20'), limpa(2, '11,18'), limpa(3, '11,18')];
    const r = summariseProbe(as);
    expect(r.frames).toBe(4);
    expect(r.textures).toBe(4);
    expect(r.maxSiblings).toBe(0);
    expect(r.sangramento).toEqual([]);
    // O veredito NÃO pode dizer "está tudo bem": as três perguntas limpas mudam o lugar da busca, não
    // encerram a busca. Dizer "ok" aqui seria transformar ausência de prova em prova de ausência.
    expect(r.verdict).toMatch(/composi|filtro|câmera/i);
  });

  it('[Right] IRMÃO desenhando o personagem é apontado, com quantos e onde', () => {
    const as = [limpa(0, '10,20'), { ...limpa(1, '10,20'), siblingsDrawing: 2, siblingPositions: '40,20 70,20' }];
    const r = summariseProbe(as);
    expect(r.maxSiblings).toBe(2);
    expect(r.verdict).toMatch(/duas vezes|irmão/i);
    expect(r.siblingExample).toBe('40,20 70,20');
  });

  it('[Right] SANGRAMENTO de atlas é apontado por textura, com o recorte e a base', () => {
    // O caso que descreve o defeito procurado: um recorte de 26×35 numa base de 256×207 é o quadro certo
    // dentro do atlas; o problema é quando o RECORTE é maior que o quadro e engole os vizinhos. Aqui a
    // heurística é a que a sonda consegue ver do lado de fora: recorte maior que a base é impossível, e
    // recorte que cobre a base inteira quando a base é grande demais para um quadro é suspeito.
    const as = [{ ...limpa(0, '10,20'), crop: '0,0 256x207', base: '256x207' }];
    const r = summariseProbe(as);
    expect(r.sangramento).toHaveLength(1);
    expect(r.sangramento[0]).toContain('256x207');
    expect(r.verdict).toMatch(/recorte|atlas/i);
  });

  it('[Boundary] escalas distintas são listadas — o squash deforma sem duplicar', () => {
    const as = [limpa(0, '10,20'), { ...limpa(1, '10,20'), scale: '1.20,0.80' }];
    const r = summariseProbe(as);
    expect(r.scales).toEqual(['1.00,1.00', '1.20,0.80']);
  });

  it('[Interface] IRMÃO vence SANGRAMENTO no veredito — a causa mais grave primeiro', () => {
    // Quando os dois aparecem, o que interessa primeiro é "alguém desenha duas vezes": é a causa que produz
    // cópias INTEIRAS em posições diferentes, que é exatamente o que foi relatado.
    const as = [{ ...limpa(0, '10,20'), crop: '0,0 256x207', base: '256x207', siblingsDrawing: 1, siblingPositions: '40,20' }];
    expect(summariseProbe(as).verdict).toMatch(/duas vezes|irmão/i);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocando a ordem do veredito (sangramento antes de irmão) → "[Interface] IRMÃO vence" reprova.
//   · devolvendo "tudo ok" quando as três perguntas vêm limpas → "[Right] quadros limpos" reprova, e o efeito
//     real seria pior que o teste: encerraria a busca no lugar errado.
//   · contando `texturas` por igualdade de recorte em vez de por id → "[Right] quadros limpos" reprova com 1,
//     que é exatamente o erro que EU cometi ao medir à mão: os quatro quadros de idle têm a mesma geometria.

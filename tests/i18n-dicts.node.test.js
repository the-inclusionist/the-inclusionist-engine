// SPDX-License-Identifier: GPL-3.0-or-later
// Testes dos DICIONÁRIOS de locale (project node — nenhum toca `document`).
//
// POR QUE ESTE ARQUIVO EXISTE
// A camada de acessibilidade é o produto deste projeto, e até agora ela não passava por `t()`: todo anúncio de
// leitor de tela era pt-BR escrito no código. Quer dizer que ela quebrava no segundo IDIOMA antes de quebrar no
// segundo JOGO. A conversão para `t()` cria três dicionários que precisam concordar — e este repositório já sabe o
// que acontece com cópias que ninguém obriga a concordar: três cópias da tabela ação→borda divergiram e quebraram a
// escalada no modo Fácil, e a documentação afirma sprite 16×32 enquanto a arte tem seis tamanhos.
//
// Então o que se testa aqui NÃO é tradução (isso é julgamento humano), é ESTRUTURA: as mesmas chaves, os mesmos
// parâmetros, e a fronteira currículo × moldura.
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const DICTS = { pt, en, es };
const TRADUZIDOS = { en, es }; // pt é o dicionário-base; os outros dois caem nele por fallback

/** Os `{param}` que uma frase declara, em ordem irrelevante. */
const paramsDe = (frase) => new Set([...String(frase).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const chavesSr = Object.keys(pt).filter((k) => k.startsWith('sr.'));

describe('dicionários de locale — estrutura', () => {
  it('[Zero] pt é o dicionário-base e tem toda chave que os outros têm', () => {
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const orfas = Object.keys(d).filter((k) => !(k in pt));
      expect(orfas, `${nome} tem chave que pt não tem — o fallback não teria para onde cair`).toEqual([]);
    }
  });

  it('[Right] toda chave `sr.*` existe nos três idiomas', () => {
    // A regra é mais dura para `sr.*` que para o resto: uma chave de UI ausente cai no fallback pt e a pessoa vê
    // português no meio do inglês, o que é feio. Um ANÚNCIO ausente cai em português no ouvido de quem depende do
    // leitor de tela para jogar — e essa pessoa não tem a tela para desempatar.
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const faltando = chavesSr.filter((k) => !(k in d));
      expect(faltando, `${nome} não traduziu estes anúncios`).toEqual([]);
    }
  });

  it('[Right] os `{param}` de cada chave são os MESMOS nos três idiomas', () => {
    // Um `{n}` esquecido na tradução não quebra nada: some silenciosamente e a frase sai sem o número.
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      for (const k of Object.keys(pt)) {
        if (!(k in d)) continue;
        expect(paramsDe(d[k]), `${nome} · ${k}`).toEqual(paramsDe(pt[k]));
      }
    }
  });

  it('[Zero] nenhuma frase deixou um `{param}` sem fechar', () => {
    for (const [nome, d] of Object.entries(DICTS)) {
      for (const [k, v] of Object.entries(d)) {
        expect(String(v).includes('{') === String(v).includes('}'), `${nome} · ${k}: ${v}`).toBe(true);
      }
    }
  });

  it('[Zero] nenhuma chave está vazia ou é igual à própria chave', () => {
    for (const [nome, d] of Object.entries(DICTS)) {
      for (const [k, v] of Object.entries(d)) {
        expect(String(v).trim(), `${nome} · ${k}`).not.toBe('');
        expect(v, `${nome} · ${k} — valor igual à chave é placeholder esquecido`).not.toBe(k);
      }
    }
  });

  it('[Right] traduzir de verdade: nenhum anúncio en/es é idêntico ao pt', () => {
    // Salvo os que legitimamente coincidem — número puro, sigla, nome próprio. Se um dia coincidirem de fato,
    // acrescente a chave à lista COM o motivo, em vez de afrouxar a asserção.
    // pt e es coincidem PALAVRA POR PALAVRA nestas duas — não é tradução esquecida, é a mesma frase nas duas
    // línguas. Cada entrada precisa do motivo escrito; lista sem motivo é afrouxamento disfarçado.
    const COINCIDEM_DE_PROPOSITO = new Set([
      'sr.visual.contrast', // 'Alto contraste: {v}.' é idêntico em pt-BR e es
      'sr.visual.lq',       // 'Realce de contraste: {v}.' idem
      // '{slot}: {acao}.' — a moldura aqui é só pontuação: os dois lados são parâmetros e já chegam
      // traduzidos. Existe como chave, e não como concatenação no código, porque uma língua que inverta a
      // ordem (ação antes da posição) precisa poder inverter — e só consegue se a ordem morar no dicionário.
      'sr.touch.slotSet',
      // 'Motor de voz: {motor}.' — "motor de voz" é a mesma expressão em pt-BR e es, palavra por palavra;
      // e o nome do motor (Piper, Kokoro) é nome próprio e chega pelo parâmetro, já sem tradução.
      'sr.audio.engineSet',
      // 'Modo TEA: {v}.' — "TEA" (Transtorno do Espectro Autista / Trastorno del Espectro Autista) é a mesma
      // sigla nas duas línguas, e o nível chega pelo parâmetro, esse sim traduzido (calmo/calmado).
      'sr.icon.tea',
      // 'ok' — empréstimo do inglês que entrou nas três línguas com a mesma grafia e o mesmo som. Traduzir
      // por "de acordo"/"aceptar" seria trocar a palavra que a criança já reconhece no botão por uma mais
      // longa e menos familiar, justamente no cursor de confirmar.
      'sr.quiz.ok',
      // '{efeito}: {nivel}.' — a moldura é DOIS parâmetros, dois-pontos e um ponto final. O efeito do CRT e o
      // nível chegam já traduzidos; não sobra palavra nenhuma para traduzir. Existe como chave, e não como
      // concatenação no código, pelo mesmo motivo do slotSet: uma língua que precise inverter a ordem só
      // consegue se a ordem morar no dicionário.
      'sr.crt.round',
      // '{alvo} congelado.' e '{alvo} animado.' — "congelado" e "animado" são a MESMA palavra em pt-BR e es,
      // com a mesma grafia e o mesmo sentido, e o alvo chega pelo parâmetro já traduzido. Mesmo caso do
      // `sr.visual.contrast` acima: coincidência de verdade entre as duas línguas, não tradução esquecida.
      'sr.rm.frozen', 'sr.rm.animated',
      // 'Sonar: {alvo} {lado}, {dist}.' — a moldura é TRÊS parâmetros e pontuação. "Sonar" é empréstimo do
      // inglês com a mesma grafia nas três línguas, e tudo que carrega sentido (o alvo, o lado, a distância)
      // chega já traduzido. Existe como chave, e não como concatenação, pelo mesmo motivo do slotSet: uma
      // língua que anuncie a distância antes do lado precisa poder inverter, e só consegue se a ordem morar
      // no dicionário.
      'sr.nav.sonarFound',
      // 'Modo {v}.' — "modo" é a mesma palavra em pt-BR e es, e o nome do modo chega pelo parâmetro. Mesmo
      // caso do sr.visual.contrast logo acima.
      'sr.mode.set',
    ]);
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const iguais = chavesSr.filter((k) => k in d && d[k] === pt[k] && !COINCIDEM_DE_PROPOSITO.has(k));
      expect(iguais, `${nome} copiou o português nestas chaves`).toEqual([]);
    }
  });
});

describe('a fronteira currículo × moldura', () => {
  // A REGRA (Dev, 2026-08-24 — ver o CLAUDE.md): o idioma do programa é o idioma da INTERFACE, e é ele que
  // define a língua de origem das atividades. O ENUNCIADO SEMPRE TRADUZ — numa atividade de ciências como numa
  // de idioma. A única exceção é o CONTEÚDO linguístico: a palavra, a letra, a sílaba, a soletração e a cela
  // Braille seguem em pt-BR, porque são a matéria. Matemática NÃO é disciplina de idioma: `2 + 3` independe de
  // língua, então "Quanto é 2 mais 3?" traduz inteiro, operadores por extenso inclusive.
  //
  // Mecanicamente: a moldura mora na chave, o conteúdo atravessa por `{param}`.

  // ESTE CASO FOI REESCRITO, e o motivo importa mais que o código.
  //
  // A versão anterior farejava VOCABULÁRIO — /\b(sílaba|soletr|grafema|fonema|braille)\b/ — partindo da minha
  // leitura de que a atividade de alfabetização INTEIRA ficaria em pt-BR. A régua do Dev é mais estreita, e
  // com ela "O jogo soletra cada opção" virou enunciado legítimo: farejar a palavra "soletra" passou a acusar
  // o inocente.
  //
  // E a versão anterior nem funcionava. O `\b` depois do radical `soletr` exige fronteira de palavra ali
  // mesmo, então ele nunca casou com "soletra" nem com "soletração" — as duas formas que de fato existem. O
  // radical era decorativo e o caso passava por não conseguir falhar, não por estar tudo em ordem.
  //
  // O que entra no lugar é a forma MECÂNICA da regra, que é verificável: quem anuncia conteúdo de currículo
  // tem de recebê-lo por `{param}`. Uma chave que fala de palavra sem ter `{palavra}` embutiu o conteúdo — e
  // então a tradução precisaria reproduzir a palavra, que é precisamente o que a regra proíbe.
  it('[Right] toda chave que anuncia conteúdo de alfabetização o recebe por PARÂMETRO', () => {
    const DE_CONTEUDO = ['sr.quiz.buildWord', 'sr.quiz.whichSpelling', 'sr.quiz.writeWord',
      'sr.quiz.brailleDictation', 'sr.quiz.wellDone'];
    for (const k of DE_CONTEUDO) {
      expect(pt[k], `chave de conteúdo ausente do dicionário: ${k}`).toBeTypeOf('string');
      for (const [nome, d] of Object.entries(DICTS)) {
        if (!(k in d)) continue;
        expect(paramsDe(d[k]), `${nome} · ${k} — a palavra tem de atravessar por {palavra}`).toContain('palavra');
      }
    }
  });

  // NÃO HÁ SEGUNDO CASO AQUI, e a ausência é o resultado de duas tentativas, não de esquecimento.
  //
  // Tentei aferir que nenhuma chave EMBUTE uma palavra do currículo. Primeiro com uma lista escrita à mão
  // (BABA, BOLA, CASA…), depois pensando em derivá-la de `SILABAS_WORDS`, que é a fonte de verdade. As duas
  // falham pela mesma razão de fundo: as palavras do currículo de alfabetização são palavras COMUNÍSSIMAS do
  // português — gato, bola, casa, lua, uva, dado, fogo. A primeira tentativa já acusou `fnot.desc.dec`, que
  // diz "uma casa decimal" e não tem nada a ver com currículo.
  //
  // Não dá para distinguir "a palavra CASA como matéria" de "casa" usada em prosa olhando só o dicionário.
  // Restringir a caixa alta cobriria menos ainda: o conteúdo chega minúsculo de `SILABAS_WORDS`.
  //
  // Então a verificação mecânica da regra é só a de cima — o conteúdo entra por `{param}`. Um teste que não
  // pode ficar correto não vale a pena guardar numa forma enfraquecida, que daria a impressão de cobrir o que
  // não cobre. Fica escrito aqui o que sobrou por fazer, para ninguém tentar uma terceira vez sem saber das
  // duas primeiras.


  it('[Interface] chave que fala de jogador ou de tela carrega o número por parâmetro', () => {
    // O que prova que a moldura foi separada do conteúdo: se o número estivesse na frase, haveria uma chave por
    // número, e a tradução teria de reproduzir a aritmética.
    const comNumero = chavesSr.filter((k) => /player\.|screens\.(alreadyN|activeN|newRoundN|wontFitN)|round\.multi/.test(k));
    expect(comNumero.length).toBeGreaterThan(5);
    for (const k of comNumero) expect(paramsDe(pt[k]), k).toContain('n');
  });
});

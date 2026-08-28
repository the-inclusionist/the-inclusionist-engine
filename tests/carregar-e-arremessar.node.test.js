// SPDX-License-Identifier: AGPL-3.0-or-later
// PEGAR, CARREGAR E ARREMESSAR — a máquina de estados, antes do objeto existir.
//
// ========================= O QUE ESTE ARQUIVO GUARDA =========================
// O roteamento de botão nasceu antes de existir objeto carregável no jogo — código sem chamador, testado e
// alcançável a partir de nada, aceito para que a decisão estivesse pronta quando o primeiro objeto chegasse.
// Chegou (a reciclagem), e a aposta pagou: não foi preciso inventar regra contra prazo.
//
// O que continua morando aqui é lógica PURA: entra o contexto de um quadro, sai uma intenção. Sem tela, sem
// mundo, sem física — e é por isso que as reviravoltas de contrato do Dev cabem em casos legíveis.
//
// ========================= O CONTRATO, NAS PALAVRAS DELE =========================
// "Botão de interação continua sendo botão de interação e servindo para conversar, pegar e jogar mesmo nos
// outros modos. O que muda é que a parte de correr (que precisa que ele seja mantido apertado) vira toggle
// em modo de teclas de alternância, controle touch, controle pelo rosto, controle por olhos e controle por
// fala."
//
// ⚠️ REVOGA O CONTRATO DE 27/08, e os casos que provavam o anterior saíram com ele. Naquele, com a
// alternância ligada, o gatilho da carga mudava para o botão de PULO — e o preço era que perto de um objeto
// o pulo pegava em vez de pular. O Dev desfez: "desfaço o que pedi".
//
// Sobrou um gatilho só, em todo modo de entrada: o botão de interação. E o "não pisar no solo" saiu junto —
// ele separava os dois toques de um botão que pulava E jogava; num botão que só interage não há dois toques
// para separar.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { acaoDeCarga, PODE } from '../app/js/game/carry.js';

// `direcao: 1` é o PADRÃO daqui porque os casos antigos são todos de arremesso, e arremessar exige direção
// desde 2026-08-28. Deixá-la fora faria os casos passarem por `undefined !== 0`, que é passar por acidente.
const ctx = (o = {}) => ({ objetoPerto: false, carregando: false, bordaDeInteracao: false, direcao: 1, tipoDaCarga: 'bola', ...o });

describe('carga · qual botão faz o quê, e em que contexto', () => {
  /* ===================== o que está na mão decide o que é permitido ===================== */

  it('[Right] COM LIXO NA MÃO o botão não solta e não arremessa — a única saída é a lixeira', () => {
    // "Uma vez que segura o lixo ele só poderá soltar na lixeira e não poderá seguir após a placa. Ou seja,
    // pegar o lixo trava ele de soltá-lo ou arremessá-lo." Soltar e lançar SÃO a desobediência; barrá-los é
    // o que faz a desobediência não ter por onde começar.
    const comLixo = { carregando: true, bordaDeInteracao: true, tipoDaCarga: 'lixo' };
    expect(acaoDeCarga(ctx({ ...comLixo, direcao: 0 })), 'sem direção').toBe('nada');
    expect(acaoDeCarga(ctx({ ...comLixo, direcao: 1 })), 'com direção').toBe('nada');
    expect(acaoDeCarga(ctx({ ...comLixo, direcao: -1 }))).toBe('nada');
  });

  it('[Right] semente e bola arremessam; objeto PERDIDO só se deixa no chão', () => {
    // A lista de arremessáveis é fechada por decisão: "nenhum outro objeto além de sementes e bolas [...] são
    // arremessáveis". E um filhote de cachorro não é projétil.
    const seg = (tipo, direcao) => acaoDeCarga(ctx({ carregando: true, bordaDeInteracao: true, tipoDaCarga: tipo, direcao }));
    expect(seg('semente', 1)).toBe('arremessar');
    expect(seg('bola', -1)).toBe('arremessar');
    expect(seg('perdido', 1), 'é de alguém — não se joga').toBe('nada');
    expect(seg('perdido', 0), 'mas pode ficar no chão até o dono aparecer').toBe('soltar');
  });

  it('[Interface] a tabela cobre as quatro classes, e só o lixo é totalmente travado', () => {
    expect(Object.keys(PODE).sort()).toEqual(['bola', 'lixo', 'perdido', 'semente']);
    const travados = Object.entries(PODE).filter(([, p]) => !p.soltar && !p.arremessar).map(([k]) => k);
    expect(travados).toEqual(['lixo']);
  });

  /* ===================== a direção separa arremessar de soltar ===================== */

  it('[Right] carregando + botão + DIREÇÃO = arremessa; sem direção = SOLTA', () => {
    // "Arremesso = apertar a direção da esquerda ou direita e apertar o botão de interação / corrida quando
    // se está segurando algo." Sem direção o objeto não voa: fica onde a criança está.
    const carregando = { carregando: true, bordaDeInteracao: true };
    expect(acaoDeCarga(ctx({ ...carregando, direcao: 1 }))).toBe('arremessar');
    expect(acaoDeCarga(ctx({ ...carregando, direcao: -1 }))).toBe('arremessar');
    expect(acaoDeCarga(ctx({ ...carregando, direcao: 0 }))).toBe('soltar');
  });

  it('[Right] SOLTAR existe para ela poder resolver outra coisa e voltar depois', () => {
    // "Ela deve poder pegar lixo e soltar para administrar seus assuntos e também poderá voltar e pegar o que
    // ficou para trás com o poder de vôo." Sem soltar, carregar seria uma armadilha: escolher um item
    // trancaria a criança nele até achar a lixeira certa.
    expect(acaoDeCarga(ctx({ carregando: true, bordaDeInteracao: true, direcao: 0 }))).toBe('soltar');
  });

  it('[Zero] sem borda nenhuma, nada acontece', () => {
    expect(acaoDeCarga(ctx({ objetoPerto: true }))).toBe('nada');
  });

  /* ===================== um gatilho só, em todo modo ===================== */

  it('[Right] objeto perto e mãos livres: o botão de interação PEGA', () => {
    expect(acaoDeCarga(ctx({ objetoPerto: true, bordaDeInteracao: true }))).toBe('pegar');
  });

  it('[Boundary] carregando vence objeto perto — não se pega o segundo com as mãos ocupadas', () => {
    expect(acaoDeCarga(ctx({ carregando: true, objetoPerto: true, bordaDeInteracao: true }))).toBe('arremessar');
  });

  it('[Right] ARREMESSA TAMBÉM NO CHÃO — não há mais "dois toques" para separar', () => {
    // O "não pisar no solo" existia para separar o primeiro toque (pular) do segundo (jogar) num botão que
    // fazia as duas coisas. Num botão que só interage, exigir estar no ar seria dificuldade inventada.
    expect(acaoDeCarga(ctx({ carregando: true, bordaDeInteracao: true, direcao: 1 }))).toBe('arremessar');
  });

  it('[Zero] O PULO NÃO PEGA NADA — ele voltou a ser só pulo, em todo modo', () => {
    // O contrato de 27/08 movia o gatilho para o pulo quando a alternância do correr estava ligada, e o preço
    // era que perto de um objeto o pulo PEGAVA em vez de pular. O Dev desfez em 28/08.
    //
    // O caso passa a borda de pulo de propósito, como quem ainda acreditasse no contrato antigo: a decisão é
    // que ela seja IGNORADA. Afirmar sobre o produto, e não sobre a forma do meu objeto de teste.
    expect(acaoDeCarga(ctx({ objetoPerto: true, bordaDePulo: true, bordaDeInteracao: false }))).toBe('nada');
    expect(acaoDeCarga(ctx({ carregando: true, bordaDePulo: true, bordaDeInteracao: false }))).toBe('nada');
  });

  it('[Zero] sem objeto perto e de mãos livres, não há o que pegar', () => {
    expect(acaoDeCarga(ctx({ bordaDeInteracao: true }))).toBe('nada');
  });

});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · pondo `objetoPerto` antes de `carregando` → "[Boundary] carregando vence" reprova. ⚠️ A primeira
//     versão desta mutação preservava a guarda `&& !ctx.carregando` e por isso PASSOU — era equivalente ao
//     código, não uma mutação. Fica anotado: mutação que não falha dá a sensação de rigor sem o rigor.
//   · fazendo a borda do PULO voltar a valer como gatilho → "[Zero] O PULO NÃO PEGA NADA" reprova, e o efeito
//     real é o contrato revogado de volta: perto de um objeto, o pulo pega em vez de pular.
//   · exigindo `!ctx.noChao` para arremessar (a regra dos "dois toques", que saiu) → "[Right] ARREMESSA
//     TAMBÉM NO CHÃO" reprova, e o efeito real é a criança só conseguir jogar no ar.

// SPDX-License-Identifier: AGPL-3.0-or-later
// PEGAR, CARREGAR E ARREMESSAR — a máquina de estados, antes do objeto existir.
//
// ========================= POR QUE ESTA PARTE PRIMEIRO =========================
// O Dev aprovou construir o mecanismo inteiro (objeto pegável, sprite na mão, física do arremesso). Duas
// perguntas dele ainda estão abertas e MUDAM o desenho: de onde vêm os objetos (postos no mapa? surgem de
// algo?) e para que servem (abrir caminho? atingir algo?). Inventar isso seria escrever regra de jogo que é
// dele, não minha.
//
// O que NÃO depende das respostas é QUAL BOTÃO FAZ O QUÊ, e em que contexto. Essa é a parte que a alternância
// do correr desloca, é lógica pura e é onde os becos se escondem — então é por ela que se começa.
//
// ========================= O CONTRATO, NAS PALAVRAS DELE =========================
// "Caso tenha um objeto que possa segurar e apertou o botão de pulo com o toggle habilitado, o botão de pulo
// fará com que o personagem segure/carregue o objeto e jogue apertando o botão de pulo duas vezes (pois o
// contexto para jogar o objeto fora com esta opção ligada é não estar pisando no solo)."
//
// Daí a ordem: carregando NO AR → arremessa; carregando NO CHÃO → pula (é o primeiro dos "dois toques");
// sem carregar e com objeto perto → pega; nada disso → pula.
//
// ⚠️ E ISSO CUSTA UMA COISA, dita aqui porque ninguém deve descobrir na tela: perto de um objeto, o pulo
// PEGA em vez de pular. É a consequência direta do contrato, e é dele — mas quem for mexer precisa saber que
// foi escolhido, e não esquecido.
//
// SEM a alternância, o gatilho é o CORRER, que é quem tem a borda livre fora do contexto de grudar.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { acaoDeCarga, PODE } from '../app/js/game/carry.js';

// `direcao: 1` é o PADRÃO daqui porque os casos antigos são todos de arremesso, e arremessar exige direção
// desde 2026-08-28. Deixá-la fora faria os casos passarem por `undefined !== 0`, que é passar por acidente.
const ctx = (o = {}) => ({ objetoPerto: false, carregando: false, noChao: true, bordaDePulo: false, bordaDeCorrer: false, direcao: 1, tipoDaCarga: 'bola', ...o });

describe('carga · qual botão faz o quê, e em que contexto', () => {
  /* ===================== o que está na mão decide o que é permitido ===================== */

  it('[Right] COM LIXO NA MÃO o botão não solta e não arremessa — a única saída é a lixeira', () => {
    // "Uma vez que segura o lixo ele só poderá soltar na lixeira e não poderá seguir após a placa. Ou seja,
    // pegar o lixo trava ele de soltá-lo ou arremessá-lo." Soltar e lançar SÃO a desobediência; barrá-los é
    // o que faz a desobediência não ter por onde começar.
    const comLixo = { carregando: true, bordaDeCorrer: true, tipoDaCarga: 'lixo' };
    expect(acaoDeCarga({}, ctx({ ...comLixo, direcao: 0 })), 'sem direção').toBe('nada');
    expect(acaoDeCarga({}, ctx({ ...comLixo, direcao: 1 })), 'com direção').toBe('nada');
    expect(acaoDeCarga({}, ctx({ ...comLixo, direcao: -1 }))).toBe('nada');
  });

  it('[Right] semente e bola arremessam; objeto PERDIDO só se deixa no chão', () => {
    // A lista de arremessáveis é fechada por decisão: "nenhum outro objeto além de sementes e bolas [...] são
    // arremessáveis". E um filhote de cachorro não é projétil.
    const seg = (tipo, direcao) => acaoDeCarga({}, ctx({ carregando: true, bordaDeCorrer: true, tipoDaCarga: tipo, direcao }));
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
    const carregando = { carregando: true, bordaDeCorrer: true };
    expect(acaoDeCarga({}, ctx({ ...carregando, direcao: 1 }))).toBe('arremessar');
    expect(acaoDeCarga({}, ctx({ ...carregando, direcao: -1 }))).toBe('arremessar');
    expect(acaoDeCarga({}, ctx({ ...carregando, direcao: 0 }))).toBe('soltar');
  });

  it('[Right] SOLTAR existe para ela poder resolver outra coisa e voltar depois', () => {
    // "Ela deve poder pegar lixo e soltar para administrar seus assuntos e também poderá voltar e pegar o que
    // ficou para trás com o poder de vôo." Sem soltar, carregar seria uma armadilha: escolher um item
    // trancaria a criança nele até achar a lixeira certa.
    expect(acaoDeCarga({ toggleRun: true }, ctx({ carregando: true, noChao: false, bordaDePulo: true, direcao: 0 })))
      .toBe('soltar');
  });

  it('[Zero] sem borda nenhuma, nada acontece', () => {
    expect(acaoDeCarga({ toggleRun: true }, ctx({ objetoPerto: true }))).toBe('nada');
  });

  /* ===================== COM a alternância: tudo no PULO ===================== */

  it('[Right] objeto perto e mãos livres: o pulo PEGA', () => {
    expect(acaoDeCarga({ toggleRun: true }, ctx({ objetoPerto: true, bordaDePulo: true }))).toBe('pegar');
  });

  it('[Right] carregando NO AR: o pulo ARREMESSA — o segundo dos dois toques', () => {
    expect(acaoDeCarga({ toggleRun: true }, ctx({ carregando: true, noChao: false, bordaDePulo: true }))).toBe('arremessar');
  });

  it('[Right] carregando NO CHÃO: o pulo PULA — é o primeiro dos dois toques', () => {
    // Se arremessasse aqui, "dois toques" seria um toque, e a criança perderia o objeto ao tentar pular com
    // ele. O contexto declarado é "não estar pisando no solo", e é ele que separa os dois.
    expect(acaoDeCarga({ toggleRun: true }, ctx({ carregando: true, noChao: true, bordaDePulo: true }))).toBe('nada');
  });

  it('[Boundary] carregando vence objeto perto — não se pega o segundo com as mãos ocupadas', () => {
    expect(acaoDeCarga({ toggleRun: true }, ctx({ carregando: true, objetoPerto: true, noChao: false, bordaDePulo: true }))).toBe('arremessar');
  });

  it('[Right] com a alternância, a borda do CORRER não pega nem arremessa', () => {
    // Ela virou a trava da corrida. Se ainda pegasse, um toque faria duas coisas — e a criança que usa a
    // alternância é justamente quem não consegue desfazer um toque acidental depressa.
    expect(acaoDeCarga({ toggleRun: true }, ctx({ objetoPerto: true, bordaDeCorrer: true }))).toBe('nada');
  });

  /* ===================== SEM a alternância: tudo no CORRER ===================== */

  it('[Right] sem a alternância, o CORRER pega e arremessa', () => {
    expect(acaoDeCarga({ toggleRun: false }, ctx({ objetoPerto: true, bordaDeCorrer: true }))).toBe('pegar');
    expect(acaoDeCarga({ toggleRun: false }, ctx({ carregando: true, noChao: false, bordaDeCorrer: true }))).toBe('arremessar');
  });

  it('[Right] sem a alternância, o CORRER arremessa TAMBÉM no chão', () => {
    // A regra do "não pisar no solo" existe para separar os dois toques do PULO. No Correr não há dois
    // toques para separar — exigir estar no ar ali seria uma dificuldade inventada.
    expect(acaoDeCarga({ toggleRun: false }, ctx({ carregando: true, noChao: true, bordaDeCorrer: true }))).toBe('arremessar');
  });

  it('[Zero] sem a alternância, o PULO não pega nada — ele continua sendo só pulo', () => {
    // O caminho de quem nunca pediu o ajuste não muda em nada. É a mesma regra do grude.
    expect(acaoDeCarga({ toggleRun: false }, ctx({ objetoPerto: true, bordaDePulo: true }))).toBe('nada');
    expect(acaoDeCarga({ toggleRun: false }, ctx({ carregando: true, noChao: false, bordaDePulo: true }))).toBe('nada');
  });

  it('[Zero] sem objeto perto e de mãos livres, não há o que pegar', () => {
    expect(acaoDeCarga({ toggleRun: true }, ctx({ bordaDePulo: true }))).toBe('nada');
    expect(acaoDeCarga({ toggleRun: false }, ctx({ bordaDeCorrer: true }))).toBe('nada');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · deixando o pulo arremessar NO CHÃO (tirando o `noChao`) → "[Right] carregando NO CHÃO" reprova, e o
//     efeito real é a criança perder o objeto toda vez que tentar pular com ele.
//   · pondo `objetoPerto` antes de `carregando` → "[Boundary] carregando vence" reprova. ⚠️ A primeira
//     versão desta mutação preservava a guarda `&& !ctx.carregando` e por isso PASSOU — era equivalente ao
//     código, não uma mutação. Fica anotado: mutação que não falha dá a sensação de rigor sem o rigor.
//   · fazendo o pulo pegar SEM `toggleRun` → "[Zero] sem a alternância, o PULO não pega nada" reprova, e o
//     efeito é roubar o pulo de quem nunca pediu o ajuste.

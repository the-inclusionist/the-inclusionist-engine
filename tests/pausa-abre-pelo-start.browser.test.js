// SPDX-License-Identifier: AGPL-3.0-or-later
// A ACÇÃO `start` ABRE A PAUSA — e o cartão que abre tem por onde SAIR (ADR-0144 + a errata dele).
//
// ========================= POR QUE ESTE FICHEIRO EXISTE =========================
// 🔴 MEDIDO em 2026-09-12: `createGame` montava o cartão de pausa, a barra de acessibilidade e quatro painéis
// de ajustes, e NADA revelava o cartão. `git grep vp-pause-` devolvia a montagem, o `getPauseMenu` da
// navegação e o par `mostrar`/`esconder` da própria raiz — que o JOGO tem de chamar. Quatro painéis no
// documento e inalcançáveis valem exactamente o mesmo que zero painéis, e custaram mais a construir.
//
// 📌 TEM DE SER UM FICHEIRO DE NAVEGADOR, pela regra do cabeçalho do `boot-create-game.browser.test.js`: o
// que se afirma é a PROPAGAÇÃO de um evento de teclado por um documento a sério, com `ui/menu-nav` a ouvir em
// CAPTURA na mesma janela e este ouvinte em BOLHA por baixo dele. Um DOM falso responde o que o duplo mandar,
// e a decisão inteira de onde enganchar saiu de medir quem vê a tecla primeiro.
//
// ⚠️ E TEM DE SER UM FICHEIRO SEU, com UMA raiz só. Cada `createGame` pendura um ouvinte na `window` e nada o
// tira — numa página a sério isso acontece uma vez, mas num ficheiro de teste que chame `createGame` por caso
// as raízes anteriores continuam a ouvir, e é a MAIS VELHA que abre o cartão primeiro. O gancho de fase do
// caso corrente nunca seria chamado, e o crivo mediria a raiz errada. Por isso a raiz nasce uma vez no
// `beforeAll` e o cartucho troca-se por `mount()`, que é o caminho que o ADR-0142 já prevê.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

let createGame;
let motor;
let raiz;
/** As fases que o JOGO recebeu — é o `setPhase` do cartucho, não o da engine. */
let fases;

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

/** A tecla como a criança a dá: despachada na região do jogo, a subir até quem a quiser. */
function apertar(code) {
  const alvo = raiz.querySelector('#game-region');
  const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  alvo.dispatchEvent(ev);
  return ev;
}

const cartao = () => document.getElementById('vp-pause-0');
const item = (act) => document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);

beforeAll(async () => {
  ({ createGame } = await import('../app/js/boot/create-game.js'));
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  fases = [];
  motor = createGame({
    declaration: declaracaoValida(),
    host: { doc: document, win: window },
    baixarPesados: false,
    setPhase: (p) => fases.push(p),
  });
});

beforeEach(() => {
  fases.length = 0;
  motor.pausa.esconder(0);
  // Um painel que um caso anterior tenha aberto não pode decidir o seguinte: o primeiro guarda do ouvinte
  // é exactamente «há um painel aberto?», e deixá-lo aberto faria o caso seguinte medir o guarda errado.
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
});

describe('a acção `start` abre a pausa', () => {
  it('🔴 [Zero] o cartão estava ESCONDIDO, e a tecla de `start` abre-o', () => {
    // ⚠️ A METADE «ESTAVA ESCONDIDO» É O CASO. Sem ela, um cartão que nascesse aberto passaria este crivo
    // sem que nada o tivesse aberto — que é precisamente o estado de antes, com outro nome.
    expect(cartao(), 'o cartão nem montou; o caso mediria a ausência dele').not.toBeNull();
    expect(cartao().hidden, 'o cartão não estava escondido antes da tecla').toBe(true);

    const ev = apertar('KeyH');

    expect(cartao().hidden, 'a acção `start` não abriu a pausa').toBe(false);
    // e abre DE FACTO, não só no atributo: é ao layout que a criança pergunta
    expect(cartao().offsetParent, '`hidden` saiu e o cartão continua sem ocupar espaço').not.toBeNull();
    // ⚠️ E A TECLA É CONSUMIDA, agora que foi nossa. `Enter` é `start` por omissão: sem isto o mesmo
    // carregar abria a pausa E accionava o que estivesse focado por trás dela — uma acção num ecrã que a
    // criança acabou de deixar. O par deste par é o caso do `KeyD`, que afirma o contrário.
    expect(ev.defaultPrevented, 'a engine abriu a pausa e deixou a tecla seguir para o que estava focado').toBe(true);
  });

  it('⚠️ a tecla é a que a CRIANÇA tem, não uma que a engine escolheu — `Enter` também é `start`', () => {
    // 📌 O ADR-0144 §3 diz que a engine nunca nomeia uma tecla: ela ouve a ACÇÃO, e `input/keyboard-runtime`
    // resolve código → acção pelo esquema do assento. O esquema solo põe `start` em `KeyH` E `Enter`
    // (`input/default-bindings:89`), e o comentário de lá explica porquê: `Enter` já pausava no monólito.
    apertar('Enter');
    expect(cartao().hidden, '`Enter` está em `start` no esquema solo e não abriu a pausa').toBe(false);
  });

  it('⚠️ uma tecla que NÃO é `start` não abre nada — o guarda é a acção, não «uma tecla qualquer»', () => {
    // [Zero] pelo outro lado. Sem este par, um ouvinte que abrisse a pausa a QUALQUER tecla passaria os
    // casos acima — e tiraria ao jogo o teclado inteiro.
    const ev = apertar('KeyD'); // `right` no esquema solo: comando de jogo, não de sistema
    expect(cartao().hidden, 'uma tecla de movimento abriu a pausa').toBe(true);
    expect(ev.defaultPrevented, 'a engine cancelou uma tecla que não é dela').toBe(false);
  });

  it('🎯 o JOGO é pedido para pausar — `setPhase(\'paused\')`, UMA vez', () => {
    apertar('KeyH');
    expect(fases, 'o gancho de fase do cartucho não foi chamado, ou foi chamado a mais').toEqual(['paused']);
  });

  it('🔴 com o cartão JÁ ABERTO, a mesma tecla não volta a pedir a pausa', () => {
    // 📏 Medido: com o cartão aberto e uma tecla de `start` que não seja `Enter`, `menuNavKey` não acha
    // intenção nenhuma (`menuKeyIntent` não tem ramo para «start») e deixa o evento passar. Sem o guarda,
    // cada carregar chamava `setPhase('paused')` num jogo já parado. FECHAR é do Escape (ADR-0044 §2).
    apertar('KeyH');
    expect(fases).toEqual(['paused']);
    apertar('KeyH');
    expect(fases, 'a segunda tecla voltou a pedir a pausa de um jogo já pausado').toEqual(['paused']);
  });

  it('🔴 [Zero] um cartucho SEM `setPhase` recebe o cartão na mesma', () => {
    // ⚠️ É O CASO QUE APANHA O `??` ESCRITO AO CONTRÁRIO. Com as duas linhas guardadas pelo gancho, a
    // ausência dele engolia a ABERTURA — e o jogo sem fases, que é o caso comum e para o qual um cartão
    // sobre um mundo a andar é a resposta CERTA, ficava exactamente como estava antes deste registo.
    motor.mount(declaracaoValida(), {}); // sem `setPhase`: o cartucho mais pobre que existe
    try {
      apertar('KeyH');
      expect(cartao().hidden, 'sem `setPhase` o cartão não abriu').toBe(false);
      expect(fases, 'o gancho do cartucho ANTERIOR foi chamado depois de ele sair').toEqual([]);
    } finally {
      // devolve o cartucho com gancho: os casos seguintes medem-no
      motor.mount(declaracaoValida(), { setPhase: (p) => fases.push(p) });
    }
  });
});

describe('o cartão que abre tem por onde SAIR (ADR-0144, errata)', () => {
  it('🔴 o item «continuar» está VIVO no cartão de um jogo que só chamou `createGame`', () => {
    // 🔴 ANTES DESTA ERRATA ELE NÃO ESTAVA. `ITENS_DA_ENGINE` é `{options, pmback, acessibilidade}` e
    // `acoesDaEngine` não definia `resume`, logo `itensQueAccionam` cortava o «continuar» de TODO cartão.
    // Ninguém reparava porque nada abria o cartão — a entrada e a saída faltavam juntas.
    apertar('KeyH');
    expect(item('resume'), 'o item «continuar» nem foi montado').not.toBeNull();
    expect(item('resume').hidden, 'o item existe e está escondido: o filtro do §5 não o viu accionar').toBe(false);
  });

  it('🎯 carregar em «continuar» FECHA o cartão e pede a retoma ao jogo', () => {
    apertar('KeyH');
    fases.length = 0;
    item('resume').click();
    expect(cartao().hidden, 'o «continuar» não fechou o cartão').toBe(true);
    expect(fases, 'o jogo não foi pedido para retomar').toEqual(['playing']);
  });

  it('🔴 o Escape na raiz do cartão também sai — e SEM `setPhase` do jogo ele também tem de sair', () => {
    // 📏 `ui/menu-nav:403` faz `ctx.setPhase('playing')` e MAIS NADA: não esconde cartão nenhum. Enquanto
    // essa porta era o `setPhase` do cartucho com padrão vazio, um jogo sem o gancho ficava com o Escape a
    // não fazer absolutamente nada — a criança que navega sem ver presa no cartão que a engine lhe abriu.
    motor.mount(declaracaoValida(), {});
    try {
      apertar('KeyH');
      expect(cartao().hidden).toBe(false);
      apertar('Escape');
      expect(cartao().hidden, 'o Escape não fechou a pausa de um jogo sem `setPhase`').toBe(true);
    } finally {
      motor.mount(declaracaoValida(), { setPhase: (p) => fases.push(p) });
    }
  });
});

describe('os guardas: três situações em que a tecla chega aqui e NÃO é nossa', () => {
  it('⚠️ com um PAINEL aberto e o cartão fechado, `start` não abre a pausa por baixo dele', () => {
    // 📌 ESTE ESTADO É O DO QUIZ, não um arranjo de teste: um jogo cujos ajustes estão sempre disponíveis
    // responde `isNavigable: () => true` e tem painéis abertos com o cartão fechado. Sem o guarda, o cartão
    // abria POR BAIXO do painel em que a criança está — e ela sairia dele para um ecrã que não pediu.
    apertar('KeyH');
    item('options').click();
    item('tipo').click();
    motor.pausa.esconder(0);
    const painel = document.querySelector('#typo');
    expect(painel.hidden, 'o painel não abriu; o caso mediria a ausência do painel').toBe(false);

    fases.length = 0;
    const ev = apertar('KeyH');

    expect(cartao().hidden, 'a pausa abriu por baixo de um painel aberto').toBe(true);
    expect(fases, 'pediu a pausa com um painel aberto').toEqual([]);
    expect(ev.defaultPrevented, 'a engine cancelou uma tecla que decidiu não usar').toBe(false);
  });

  // ⚠️ ESTE CASO FICA POR ÚLTIMO, DE PROPÓSITO. `entrarNaBarra` não tem par público — `sairDaBarra` não é
  // exportado pelo motor —, logo o modo fica ligado até ao fim do ficheiro. Pô-lo antes faria todos os casos
  // seguintes medirem o guarda da barra em vez do que dizem medir.
  it('⚠️ com a criança NA BARRA de acessibilidade, `start` é da barra e não da pausa', () => {
    // 📌 O item 7 do ADR-0044 dá o START à barra: ele é a SEGUNDA saída do modo. Essa rota ainda não está
    // montada nesta raiz (a nota do `navBar`, em `create-game.ts`, di-lo em tantas palavras), e tomar-lhe a
    // tecla agora fecharia a porta antes de ela existir.
    apertar('KeyH');
    // ⚠️ DESDE O ADR-0151 A PORTA É O SELECT (`KeyF` por omissão), e não o item «acessibilidade», que saiu da
    // raiz. Entra no modo — e o `resume` da errata do ADR-0144 fecha o cartão ao entrar.
    const select = apertar('KeyF');
    expect(cartao().hidden, 'entrar na barra tinha de fechar o cartão — é o `acts.resume()` do modo').toBe(true);
    expect(select.defaultPrevented, 'o SELECT foi nosso e seguiu para trás').toBe(true);

    fases.length = 0;
    apertar('KeyH');

    expect(cartao().hidden, 'a pausa abriu por cima do modo barra, roubando-lhe o START').toBe(true);
    expect(fases, 'pediu a pausa com a criança na barra').toEqual([]);

    // 📌 O PAR: o SELECT outra vez SAI da barra — e o START volta a ser da pausa. Sem isto, um SELECT que
    // só entrasse deixava a criança presa no modo, e o caso de cima passava na mesma.
    apertar('KeyF');
    apertar('KeyH');
    expect(cartao().hidden, 'o SELECT não tirou a criança da barra: o START continuou a ser dela').toBe(false);
  });
});

// ============================== MUTAÇÕES CONFERIDAS ==============================
// Aplicadas por script ao ficheiro, com a contagem de ocorrências conferida ANTES de cada uma — uma entrada
// que casa zero parece cobertura e não é. As catorze reprovaram; onze medem este ficheiro:
//
//   M1  `win.addEventListener('keydown', abrirPausaPeloStart)` → `void …`        🔴 nada abre a pausa
//   M2  `… === 'start' ? dono : null` → `return dono`                            🔴 `KeyD` abre a pausa
//   M3  o guarda do painel aberto sai                                            🔴 abre por baixo do painel
//   M4  o guarda da barra de a11y sai                                            🔴 rouba o START à barra
//   M5  `if (!cartao || cartao.hidden === false)` → `if (!cartao)`               🔴 pede a pausa duas vezes
//   M6  `pausa.mostrar(…)` → só com `cartucho.setPhase`                          🔴 o `??` ao contrário
//   M7  `e.preventDefault()` sai                                                 🔴 a tecla segue para trás
//   M8  `acoesDaEngine.resume` sai                                               🔴 cartão sem «continuar»
//   M9  `setPhase: mudarDeFase` → `cartucho.setPhase ?? (() => {})`              🔴 Escape não fecha
//   M10 `if (p !== 'paused') pausa.esconder(0)` nunca corre                      🔴 «continuar» não fecha
//   M14 `Enter` deixado de fora de `start`   (alvo: `cartao-de-pausa-nao-come-teclas`)
//
// E três medem o crivo de recusa, em `boot-create-game.node.test.js`:
//   M11 `startClaimProblem` devolve sempre `null`                                🔴 o `start` passa
//   M12 `startClaimProblem` acusa SEMPRE                                         🔴 o par apanha-a
//   M13 `recusarSeTomaOStart('mount', …)` sai                                    🔴 o segundo cartucho passa

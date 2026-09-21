// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME ASKS THE ENGINE TO LISTEN (ADR-0216, issue #200) — the Dev, 2026-09-21: «O jogo não deve precisar saber como isso
// funciona, apenas deve pedir para ouvir e receber o texto.»
//
// Here the engine is mounted for real and the BROWSER's recogniser is the double: what is measured is the wiring — a game that
// declares `uses: { reading: true }` gets text, a game that declares nothing is refused with a line an adult can read, and neither
// path ever builds a recogniser that would send the child's voice away.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGame } from '../app/js/boot/create-game.js';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let sessions, originalApi;

function fakeRecognition() {
  sessions = [];
  function Rec() {
    this.lang = ''; this.processLocally = false; this.continuous = false; this.interimResults = false;
    this.onresult = null; this.onerror = null; this.onend = null;
    this.start = () => { this.started = true; };
    this.stop = () => { this.stopped = true; };
    sessions.push(this);
  }
  Rec.prototype.processLocally = false;
  Rec.available = async () => 'available';
  return Rec;
}

/** The smallest game the engine accepts, as `boot-create-game.browser` builds it: what is measured here is the listening. */
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

const montar = (opcoes = {}) => createGame({
  acomodacoes: SEM_ASSUNTO,
  declaration: declaracao(),
  host: { doc: document, win: window },
  baixarPesados: false,
  ...opcoes,
});

beforeEach(() => {
  document.body.innerHTML = '<div id="game-region"></div>';
  originalApi = window.SpeechRecognition;
  window.SpeechRecognition = fakeRecognition();
});
afterEach(() => { window.SpeechRecognition = originalApi; document.body.innerHTML = ''; });

const aSessao = async () => { for (let i = 0; i < 50 && !sessions.length; i++) await Promise.resolve(); return sessions[0]; };

describe('motor.reading, as a game sees it', () => {
  it('🔴 [Right] a game that declares it listens receives the text the child read', async () => {
    const motor = montar({ uses: { reading: true } });
    const ouvindo = motor.reading.listen();
    const s = await aSessao();
    expect(s, 'no microphone was opened for a game that declared it listens').toBeTruthy();
    s.onresult({ results: [[{ transcript: 'o menino leu' }]] });
    motor.reading.stop();
    expect((await ouvindo).text).toBe('o menino leu');
    motor.unmount?.();
  });

  it('🔴 [Zero] a game that declares nothing is refused, and `problems` says which line is missing', async () => {
    const motor = montar();
    await expect(motor.reading.listen()).rejects.toThrow(/uses: \{ reading: true \}/);
    expect(sessions, 'a microphone was opened for a game that never asked for one').toHaveLength(0);
    expect(motor.problems.join(' ')).toMatch(/without declaring/);
    expect(await motor.reading.ready()).toMatchObject({ can: false });
    motor.unmount?.();
  });

  it('⚠️ [Boundary] a browser that cannot recognise ON THE DEVICE is never used, declared or not', async () => {
    // ⚠️ `processLocally` missing from the prototype is how a browser says it would recognise on ITS servers (ADR-0200 erratum).
    function Servidor() { this.start = () => {}; this.stop = () => {}; sessions.push(this); }
    Servidor.prototype = {};
    Servidor.available = async () => 'available';
    window.SpeechRecognition = Servidor;
    const motor = montar({ uses: { reading: true } });
    // 📌 `ready()` says YES since ADR-0216, and the reason is the whole decision: the engine has a model of its own, so a child
    // on a browser that would only hear her through a server is still heard — on her machine. Before it, this answered «no».
    expect(await motor.reading.ready()).toMatchObject({ can: true });
    await expect(motor.reading.listen()).rejects.toThrow();
    expect(sessions, 'the child\'s voice would have gone to a server').toHaveLength(0);
    motor.unmount?.();
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-reading-createGame.py`:
//   · the declaration ignored, everyone listens     → «a game that declares nothing is refused»
//   · the refusal written to nobody                 → «`problems` says which line is missing»
//   · the object not handed to the cartridge        → «receives the text the child read»

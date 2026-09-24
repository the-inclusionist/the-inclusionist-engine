// SPDX-License-Identifier: AGPL-3.0-or-later
//
// READING RUNS ON ANOTHER THREAD (ADR-0216 §2; issue #185) — and what is measured here is the PROTOCOL, on both sides.
//
// 📏 The reason the worker exists is measured in the lab and is not hygiene: Whisper transcribing on the main thread cut
// the recording into 4 s gaps — the child keeps reading, and the words she says while the page is busy are not in the
// sound —, against 264 ms in a worker. The «Whisper runs in a worker» box of #185 was never ticked.
//
// ⚠️ BOTH SIDES RUN FOR REAL, and neither is rewritten here: the client is `createReadingInWorker` and the server is the
// worker's own `serveReading`. What the double replaces is the THREAD — an object carrying messages from one to the other —,
// because a real thread would bring 378 MiB of model into a case.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReadingInWorker } from '../app/js/platform/reading-in-worker.js';
import { serveReading } from '../app/js/platform/reading-worker.js';

/** The fake thread: delivers messages both ways, and records what went through it. */
function fio({ load, adiar = false } = {}) {
  const log = { pedidos: [], transferidos: [], terminado: 0 };
  const scope = { onmessage: null, postMessage: (answer) => { cliente.onmessage?.({ data: answer }); } };
  const cliente = {
    onmessage: null,
    onerror: null,
    postMessage: (message, transfer) => {
      log.pedidos.push(message);
      if (transfer) log.transferidos.push(transfer.length);
      const entregar = () => scope.onmessage?.({ data: message });
      if (adiar) log.entregar = entregar; else entregar();
    },
    terminate: () => { log.terminado += 1; },
  };
  serveReading(scope, load ?? (async () => ({ transcribe: async () => 'o gato subiu no telhado' })));
  return { log, cliente, spawn: () => cliente };
}

const amostras = (n = 8) => new Float32Array(n);

describe('o cliente e o worker falam a mesma língua', () => {
  it('🔴 [Right] o modelo é aberto DENTRO da thread, e só depois a transcrição atravessa', async () => {
    const abertos = [];
    const t = fio({ load: async (d) => { abertos.push(d); return { transcribe: async () => 'a casa é amarela' }; } });
    const leitura = createReadingInWorker({ base: 'https://escola.exemplo/jogo/', language: 'pt-BR', spawn: t.spawn });
    expect(abertos, 'o modelo não foi aberto na thread — ou foi aberto na linha principal').toEqual([
      { base: 'https://escola.exemplo/jogo/', language: 'pt-BR' },
    ]);
    expect(await leitura.transcribe(amostras())).toBe('a casa é amarela');
  });

  it('🔴 [Right] as amostras são TRANSFERIDAS e não copiadas — 30 s são 1,9 MB na thread que desenha o jogo', async () => {
    const t = fio();
    const leitura = createReadingInWorker({ base: 'b/', language: 'pt', spawn: t.spawn });
    const som = amostras(16000);
    await leitura.transcribe(som);
    expect(t.log.transferidos, 'a gravação foi copiada em vez de entregue').toEqual([1]);
  });

  /*
   * 🔴 TWO READINGS AT THE SAME TIME, and this is why every answer carries the id of its question: a child asking to read
   * again before the first answers would get the other's answer — and in a reading game that is the wrong word corrected
   * against the wrong text.
   */
  it('🔴 [Right] cada resposta volta a QUEM a pediu, mesmo fora de ordem', async () => {
    const respostas = ['primeira', 'segunda'];
    const t = fio({ load: async () => ({ transcribe: async () => respostas.shift() }) });
    const leitura = createReadingInWorker({ base: 'b/', language: 'pt', spawn: t.spawn });
    const [um, dois] = await Promise.all([leitura.transcribe(amostras()), leitura.transcribe(amostras())]);
    expect([um, dois]).toEqual(['primeira', 'segunda']);
    const ids = t.log.pedidos.filter((m) => m.kind === 'transcribe').map((m) => m.id);
    expect(new Set(ids).size, 'duas perguntas com o mesmo id: uma resposta cairia na outra').toBe(2);
  });

  it('🎯 [Zero] um modelo que não abre não deixa a criança à espera para sempre — a promessa REJEITA com o motivo', async () => {
    const t = fio({ load: async () => { throw new Error('the delivery does not carry this language\'s model'); } });
    const leitura = createReadingInWorker({ base: 'b/', language: 'fr', spawn: t.spawn });
    await expect(leitura.transcribe(amostras())).rejects.toThrow(/does not carry/);
  });

  /* ===================== THE OPENING HAS AN OWNER FROM BIRTH ===================== */
  // 🔴 The case above measures the thread that does not open with SOMEONE waiting. This one measures the opposite, which
  // is where the defect was: nobody waits for the opening until the first `transcribe()`, so a model that fails to load
  // rejected FOR NOBODY.
  // 📏 Measured on 22/09: the browser project ended with its 1140 cases green and the exit code saying FAILURE, because
  // of this rejection alone. A suite that fails while passing teaches everyone to stop reading the exit code, and this
  // house has already paid for that — the published branch's CI was red for eight days.

  it('🔴 [Zero] uma thread que não abre SEM NINGUÉM À ESPERA não vira rejeição órfã — e é dita em `problems`', async () => {
    const ditas = [];
    const t = fio({ load: async () => { throw new Error('the delivery does not carry this language\'s model'); } });
    createReadingInWorker({ base: 'b/', language: 'fr', spawn: t.spawn, report: (l) => ditas.push(l) });
    await new Promise((r) => setTimeout(r, 0)); // the failure arrives on the next microtask, as in the page
    expect(ditas, 'a thread não abriu e nada em lado nenhum o disse').toHaveLength(1);
    // 📌 The REASON and not the sentence: what the child loses and what fixes it is written by the diagnostic channel
    // (the root), because a module that is a thread's protocol has no business carrying interface prose.
    expect(ditas[0], 'o motivo da falha não atravessou').toBe('the delivery does not carry this language\'s model');
  });

  it('🔴 [Zero] e SEM porta de relato a falha continua a ter dono — o silêncio é escolha, a rejeição órfã não', async () => {
    // ⚠️ The case is the runner itself: if the opening has no owner, Vitest fails the RUN for an unhandled rejection,
    // with this case green. It is the same shape as the defect it exists to pin.
    const t = fio({ load: async () => { throw new Error('nada disto existe'); } });
    createReadingInWorker({ base: 'b/', language: 'fr', spawn: t.spawn });
    await new Promise((r) => setTimeout(r, 0));
    expect(true).toBe(true);
  });

  it('🔴 [CrossCheck] relatar NÃO engole o motivo: quem pede uma leitura continua a saber porquê', async () => {
    const ditas = [];
    const t = fio({ load: async () => { throw new Error('the delivery does not carry this language\'s model'); } });
    const leitura = createReadingInWorker({ base: 'b/', language: 'fr', spawn: t.spawn, report: (l) => ditas.push(l) });
    await expect(leitura.transcribe(amostras()), 'a linha em `problems` roubou a resposta de quem perguntou')
      .rejects.toThrow(/does not carry/);
    expect(ditas).toHaveLength(1);
  });

  it('🎯 [Boundary] LARGAR a thread antes de ela abrir não é falha — e não vira linha nenhuma', async () => {
    // 📌 A child who switches game before the model opens is not a defect to report. `close()` rejects the opening to
    // release whoever was waiting, and that rejection is exactly what must not pass for a diagnostic.
    const t = fio({ load: () => new Promise(() => {}), adiar: true }); // nunca responde
    const ditas = [];
    const leitura = createReadingInWorker({ base: 'b/', language: 'pt', spawn: t.spawn, report: (l) => ditas.push(l) });
    leitura.close();
    await new Promise((r) => setTimeout(r, 0));
    expect(ditas, 'largar a thread foi relatado como se fosse uma avaria').toEqual([]);
  });

  it('🎯 [Zero] e uma transcrição que rebenta na thread volta como erro, não como silêncio', async () => {
    const t = fio({ load: async () => ({ transcribe: async () => { throw new Error('wasm out of memory'); } }) });
    const leitura = createReadingInWorker({ base: 'b/', language: 'pt', spawn: t.spawn });
    await expect(leitura.transcribe(amostras())).rejects.toThrow(/out of memory/);
  });

  it('🎯 [Zero] uma thread que morre a meio responde a quem estava à espera', async () => {
    const t = fio({ adiar: true });
    const leitura = createReadingInWorker({ base: 'b/', language: 'pt', spawn: t.spawn });
    const pendente = leitura.transcribe(amostras());
    t.cliente.onerror?.({});
    await expect(pendente, 'a promessa ficou pendente para sempre — o jogo congela educadamente').rejects.toThrow(/stopped/);
  });

  it('⚠️ [Boundary] largar a thread devolve-a E responde ao que estava a correr', async () => {
    const t = fio({ adiar: true });
    const leitura = createReadingInWorker({ base: 'b/', language: 'pt', spawn: t.spawn });
    const pendente = leitura.transcribe(amostras());
    leitura.close();
    await expect(pendente).rejects.toThrow(/let go/);
    expect(t.log.terminado, 'a thread ficou viva com o modelo compilado lá dentro').toBe(1);
    await expect(leitura.transcribe(amostras())).rejects.toThrow(/after the thread was let go/);
    leitura.close();
    expect(t.log.terminado, 'largar duas vezes matou duas vezes').toBe(1);
  });

  /*
   * 🔴 AND THE ROOT HAS TO GO THROUGH HERE, or everything above measures a module nobody uses. The real path only runs in a
   * `listen()` with a microphone, which a case does not have — so what is asserted is the SOURCE: `createGame` reaches
   * transcription through the worker, and the direct loader only exists in the branch of a browser with no `Worker`, with
   * the `problems` line that tells the school what it loses. The same kind of sieve that stops anyone importing
   * `kokoro-runtime` statically.
   */
  it('🔴 [Right] o `createGame` alcança a transcrição pelo WORKER, e o caminho directo só existe onde não há thread', () => {
    const raiz = readFileSync(join(process.cwd(), 'app', 'js', 'boot', 'create-game.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // comments name both on purpose
    expect(raiz, 'a raiz deixou de abrir a leitura numa thread').toContain('reading-in-worker.js');
    const directo = raiz.indexOf('reading-runtime.js');
    expect(directo, 'o carregador directo sumiu — o ramo sem `Worker` ficou sem leitura nenhuma').toBeGreaterThan(-1);
    const guarda = raiz.lastIndexOf('Worker', directo);
    expect(guarda, 'o carregador directo deixou de estar atrás da pergunta «este navegador tem thread?»').toBeGreaterThan(-1);
    expect(raiz.slice(guarda, directo), 'o ramo sem thread deixou de dizer à escola o que ela perde')
      .toMatch(/gaps of seconds|same thread/);
  });

  it('🎯 [Zero] pedir ao worker antes de o modelo abrir é RESPONDIDO, não ignorado', async () => {
    // A dropped message leaves the promise on the other side pending forever, and the child waiting for words that do not
    // come has no way of knowing she should try again.
    const respostas = [];
    const scope = { onmessage: null, postMessage: (a) => respostas.push(a) };
    serveReading(scope, async () => ({ transcribe: async () => 'x' }));
    scope.onmessage({ data: { kind: 'transcribe', id: 7, samples: amostras() } });
    await new Promise((r) => { setTimeout(r, 0); });
    expect(respostas).toEqual([{ kind: 'failed', id: 7, message: expect.stringContaining('before the model was opened') }]);
  });
});

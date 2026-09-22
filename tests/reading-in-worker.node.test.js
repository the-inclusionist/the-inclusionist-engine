// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A LEITURA CORRE NOUTRA THREAD (ADR-0216 §2; issue #185) — e o que se mede aqui é o PROTOCOLO, dos dois lados.
//
// 📏 A razão de o worker existir está medida no laboratório e não é higiene: o Whisper a transcrever na linha principal cortava
// a gravação em lacunas de 4 s — a criança continua a ler e as palavras que ela diz enquanto a página está ocupada não estão no
// som —, contra 264 ms num worker. A caixa «Whisper runs in a worker» da #185 nunca foi marcada.
//
// ⚠️ OS DOIS LADOS CORREM A SÉRIO, e nenhum é reescrito aqui: o cliente é o `createReadingInWorker` e o servidor é o
// `serveReading` do próprio worker. O que o duble substitui é a THREAD — um objecto que leva as mensagens de um ao outro —,
// porque uma thread de verdade traria 378 MiB de modelo para dentro de um caso.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReadingInWorker } from '../app/js/platform/reading-in-worker.js';
import { serveReading } from '../app/js/platform/reading-worker.js';

/** A thread de mentira: entrega as mensagens nos dois sentidos, e regista o que passou por ela. */
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
   * 🔴 DUAS LEITURAS AO MESMO TEMPO, e é por isto que cada resposta carrega o id da pergunta: uma criança que pede para ler
   * outra vez antes de a primeira responder receberia a resposta da outra — e num jogo de leitura isso é a palavra errada
   * corrigida contra o texto errado.
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

  /* ===================== A ABERTURA TEM DONO DESDE QUE NASCE ===================== */
  // 🔴 O caso acima mede a thread que não abre com ALGUÉM à espera. Este mede o contrário, e é onde estava o defeito:
  // ninguém espera pela abertura até à primeira `transcribe()`, logo um modelo que não carrega rejeitava PARA NADA.
  // 📏 Medido em 22/09: o projecto de navegador acabava com os 1140 casos verdes e o código de saída a dizer FALHA,
  // por causa desta rejeição sozinha. Uma suíte que reprova enquanto passa ensina toda a gente a parar de ler o
  // código de saída, e esta casa já pagou por isso — o CI do ramo publicado esteve vermelho oito dias.

  it('🔴 [Zero] uma thread que não abre SEM NINGUÉM À ESPERA não vira rejeição órfã — e é dita em `problems`', async () => {
    const ditas = [];
    const t = fio({ load: async () => { throw new Error('the delivery does not carry this language\'s model'); } });
    createReadingInWorker({ base: 'b/', language: 'fr', spawn: t.spawn, report: (l) => ditas.push(l) });
    await new Promise((r) => setTimeout(r, 0)); // a falha chega no microtask seguinte, como na página
    expect(ditas, 'a thread não abriu e nada em lado nenhum o disse').toHaveLength(1);
    // 📌 O MOTIVO e não a frase: quem escreve o que a criança perde e o que se conserta é o canal de diagnóstico
    // (a raiz), porque um módulo que é o protocolo de uma thread não tem nada que carregar prosa de interface.
    expect(ditas[0], 'o motivo da falha não atravessou').toBe('the delivery does not carry this language\'s model');
  });

  it('🔴 [Zero] e SEM porta de relato a falha continua a ter dono — o silêncio é escolha, a rejeição órfã não', async () => {
    // ⚠️ O caso é o próprio corredor: se a abertura não tiver dono, o Vitest reprova a RODADA por rejeição não
    // apanhada, com este caso verde. É a mesma forma do defeito que ele existe para prender.
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
    // 📌 Uma criança que troca de jogo antes de o modelo abrir não é um defeito a relatar. O `close()` rejeita a
    // abertura para libertar quem esperava, e é exactamente essa rejeição que não pode passar por diagnóstico.
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
   * 🔴 E A RAIZ TEM DE PASSAR POR AQUI, senão tudo o que está acima mede um módulo que ninguém usa. O caminho de verdade só
   * corre num `listen()` com microfone, que um caso não tem — então o que se afirma é a FONTE: o `createGame` alcança a
   * transcrição pelo worker, e o carregador directo só existe no ramo do navegador sem `Worker`, com a linha de `problems`
   * que diz à escola o que ela perde. É a mesma forma de crivo que impede alguém de importar o `kokoro-runtime` estaticamente.
   */
  it('🔴 [Right] o `createGame` alcança a transcrição pelo WORKER, e o caminho directo só existe onde não há thread', () => {
    const raiz = readFileSync(join(process.cwd(), 'app', 'js', 'boot', 'create-game.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // comentários citam os dois nomes de propósito
    expect(raiz, 'a raiz deixou de abrir a leitura numa thread').toContain('reading-in-worker.js');
    const directo = raiz.indexOf('reading-runtime.js');
    expect(directo, 'o carregador directo sumiu — o ramo sem `Worker` ficou sem leitura nenhuma').toBeGreaterThan(-1);
    const guarda = raiz.lastIndexOf('Worker', directo);
    expect(guarda, 'o carregador directo deixou de estar atrás da pergunta «este navegador tem thread?»').toBeGreaterThan(-1);
    expect(raiz.slice(guarda, directo), 'o ramo sem thread deixou de dizer à escola o que ela perde')
      .toMatch(/gaps of seconds|same thread/);
  });

  it('🎯 [Zero] pedir ao worker antes de o modelo abrir é RESPONDIDO, não ignorado', async () => {
    // Uma mensagem deixada cair deixa a promessa do outro lado pendente para sempre, e a criança à espera de palavras que
    // não vêm não tem como saber que devia tentar outra vez.
    const respostas = [];
    const scope = { onmessage: null, postMessage: (a) => respostas.push(a) };
    serveReading(scope, async () => ({ transcribe: async () => 'x' }));
    scope.onmessage({ data: { kind: 'transcribe', id: 7, samples: amostras() } });
    await new Promise((r) => { setTimeout(r, 0); });
    expect(respostas).toEqual([{ kind: 'failed', id: 7, message: expect.stringContaining('before the model was opened') }]);
  });
});

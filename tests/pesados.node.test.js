// SPDX-License-Identifier: AGPL-3.0-or-later
// AS COISAS PESADAS DESCEM NO PRIMEIRO CARREGAMENTO — e o que não tem de onde vir DIZ-SE (ADR-0110/0116/0119).
//
// ========================= O QUE ESTE FICHEIRO GUARDA =========================
// 📏 O ADR-0119 mediu que, das quatro coisas pesadas que a engine promete, só UMA era entregue. O buscador
// existe para mudar isso — e o defeito que ele pode introduzir é pior do que o que conserta: um buscador que
// SALTA em silêncio o que não tem URL faz um subsistema por fazer parecer tratado, que é exactamente a forma
// do falso relatório que este repositório já apanhou três vezes.
//
// 🎯 Por isso a asserção central não é «baixou»: é que uma entrada SEM FONTE devolve `sem-fonte` com a razão.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { baixarPesados, pesoPorBaixar, PESADOS, CACHE_PESADOS } from '../app/js/platform/pesados.js';
import { HOST_DOS_MODELOS } from '../app/js/platform/voice-plan.js';

/** Uma Cache Storage de mentira, que CONTA o que lhe pedem. */
function cacheFalsa(jaTem = []) {
  const guardados = new Set(jaTem);
  const postos = [];
  const cache = {
    match: async (u) => (guardados.has(u) ? { ok: true } : undefined),
    put: async (u) => { postos.push(u); guardados.add(u); },
  };
  return { abertos: [], postos, cacheStorage: { open: async (n) => { cache._nome = n; return cache; } }, cache };
}

const buscarOk = () => async () => ({ ok: true, status: 200, clone: () => ({}) });

describe('o buscador das coisas pesadas', () => {
  it('🎯 [Zero] o que NÃO tem fonte devolve `sem-fonte` COM a razão — nunca é saltado em silêncio', async () => {
    const f = cacheFalsa();
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk() });
    const sem = r.filter((x) => x.estado === 'sem-fonte');
    expect(sem.map((x) => x.id).sort(), 'só a arte continua por decidir — a visão ganhou fonte no ADR-0124/0132').toEqual(['arte:lcp']);
    for (const s of sem) {
      expect(s.erro, `${s.id} não diz PORQUE não tem fonte`).toBeTruthy();
      expect(s.erro.length, `${s.id} tem uma razão curta demais para servir a alguém`).toBeGreaterThan(40);
    }
  });

  it('[Right] as oito entradas de voz descem, e cada voz traz o MODELO e a CONFIGURAÇÃO', async () => {
    const f = cacheFalsa();
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk() });
    // ⚠️ oz: passou a cobrir também o RUNTIME (oz:runtime*, ADR-0127). O que este caso afirma são os
    // MODELOS, e a diferença é a mesma que separa o .onnx do motor que o toca.
    const vozes = r.filter((x) => /^voz:[a-z]{2}_[A-Z]{2}-/.test(x.id) && x.estado === 'baixado');
    // ⚠️ OITO e não quatro: sem o `.onnx.json` o piper não fala, e uma voz «baixada» que não fala é pior do
    // que uma voz em falta — a primeira parece resolvida.
    expect(vozes.length, 'quatro vozes são OITO ficheiros').toBe(8);
    expect(f.postos.filter((u) => u.endsWith('.onnx.json')).length).toBe(4);
  });

  it('🎯 [Zero] o catálogo NÃO escreve endereço nenhum — as URLs vêm do `voice-plan`, que é o sítio único', () => {
    // 🔴 O DEFEITO QUE ESTE CASO GUARDA FOI COMETIDO, e por mim: a primeira versão do catálogo escrevia
    // `const HF = 'https://huggingface.co/…'`, a lista das quatro vozes outra vez, e uma segunda derivação do
    // caminho. As três coisas já viviam no `platform/voice-plan`, que o ADR-0114 designou como o sítio ÚNICO
    // — e cujo comentário nomeia as três vezes que este repositório pagou por tabelas duplicadas.
    // ⚠️ QUEM APANHOU FOI O INVENTÁRIO DE URLs, e por acaso: ele recusou uma URL nova sem razão escrita.
    // DECLARÁ-LA teria deixado tudo verde COM a duplicação lá dentro — a saída fácil e errada. Este caso
    // afirma a coisa certa directamente, para o próximo não depender da sorte.
    // ⚠️ COMENTÁRIOS FORA, e o `(^|[^:])` é o conserto que o `nada-de-cdn-a-mao` já pagou: um `//` precedido
    // de `:` é o dobro da barra de um esquema, nunca o início de um comentário. Sem isto o crivo comeria a
    // linha inteira; com um tira-comentários ingénuo ele apanhava-se a si próprio — este cabeçalho CITA o
    // endereço para explicar o defeito, e contar a prosa cria o incentivo de apagar a explicação.
    // ⚠️ E A REGRA ESTREITOU EM 2026-09-09, PORQUE A LARGA PASSOU A SER FALSA. Ela dizia «o catálogo não
    // escreve endereço NENHUM», o que era certo enquanto só as vozes desciam: o host delas é do `voice-plan`
    // por exigência do ADR-0114. Com os RUNTIMES (ADR-0124/0127/0132), este ficheiro passou a ser o sítio
    // único deles — não há um `voice-plan` do MediaPipe, e inventar um seria uma casa vazia para uma linha.
    // 🎯 O que continua a valer, e é o que o defeito exigia, é a metade das VOZES: o host dos modelos não
    // pode ser reescrito aqui. Um crivo que proibisse todos os endereços passaria a proibir a decisão certa.
    const fonte = readFileSync(new URL('../app/js/platform/pesados-catalogo.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');
    const literais = [...fonte.matchAll(/['"`](https?:\/\/[^'"`]+)['"`]/g)].map((m) => m[1]);
    const host = HOST_DOS_MODELOS.replace(/\/resolve\/main\/?$/, '');
    expect(
      literais.filter((u) => u.startsWith(host) || u.includes('piper-voices')),
      'o catálogo voltou a escrever o host das VOZES — ele é do `voice-plan`, e duas cópias divergem',
    ).toEqual([]);

    // 📌 O PAR: sem esta metade, apagar as vozes do catálogo passaria. Elas têm de CHEGAR, derivadas.
    const modelos = PESADOS.filter((p) => /^voz:[a-z]{2}_[A-Z]{2}-/.test(p.id) && p.url);
    expect(modelos.length, 'as vozes deixaram de derivar do `voice-plan`').toBe(8);
    expect(modelos.every((p) => p.url.startsWith(HOST_DOS_MODELOS)), 'uma voz não veio do host declarado').toBe(true);
  });

  it('📏 [Boundary] toda voz COM fonte tem peso MEDIDO — uma voz nova sem medição sub-reportaria em silêncio', () => {
    // ⚠️ O buraco é pequeno e mudo, que é a forma que este repositório persegue: acrescentar uma quinta voz
    // ao `voice-plan` sem a medir aqui deixaria o `pesoPorBaixar` a somar 241 MB quando faltam 300, e o aviso
    // que diz à escola quanto vai descer mentiria por omissão. Ninguém veria erro nenhum.
    const semPeso = PESADOS.filter((p) => p.id.startsWith('voz:') && p.url && !(p.bytes > 0));
    expect(semPeso.map((p) => p.id), 'voz sem peso medido — meça e ponha em PESO_MEDIDO').toEqual([]);
  });

  it('📌 [Boundary] o que já está na cache não é buscado outra vez — isto corre em TODO arranque', async () => {
    const primeiro = PESADOS.find((p) => p.url).url;
    const f = cacheFalsa([primeiro]);
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk() });
    expect(r.find((x) => x.estado === 'ja-tinha'), 'não reconheceu o que já tinha').toBeTruthy();
    expect(f.postos.includes(primeiro), 'voltou a gravar o que já estava lá').toBe(false);
  });

  it('🔴 [Inverse] uma falha de rede é REPORTADA e a lista CONTINUA — não derruba o arranque', async () => {
    const f = cacheFalsa();
    let n = 0;
    const buscar = async () => { n += 1; if (n === 1) throw new Error('rede caiu'); return { ok: true, clone: () => ({}) }; };
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar });
    expect(r.filter((x) => x.estado === 'falhou').length, 'a falha não foi reportada').toBe(1);
    expect(r.filter((x) => x.estado === 'baixado').length, 'a lista parou na primeira falha').toBe(PESADOS.filter((p) => p.url).length - 1);
  });

  it('[Interface] `apenas` limita a lista — um consumidor pode querer só as vozes', async () => {
    const f = cacheFalsa();
    const id = PESADOS.find((p) => p.url).id;
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk(), apenas: [id] });
    expect(r.map((x) => x.id)).toEqual([id]);
  });

  it('📏 o peso por baixar é o das que TÊM fonte e ainda não desceram', async () => {
    const semNada = pesoPorBaixar([]);
    // ~241 MB: quatro modelos de ~60 MB. As duas sem fonte não somam, porque não há o que baixar.
    expect(Math.round(semNada / 1024 / 1024), 'o total mudou — confira o catálogo').toBe(285);
    const f = cacheFalsa();
    const r = await baixarPesados({ cacheStorage: f.cacheStorage, buscar: buscarOk() });
    expect(pesoPorBaixar(r), 'depois de tudo descer não falta nada').toBe(0);
  });

  it('⚠️ [Zero] sem Cache Storage nada rebenta — reporta e devolve', async () => {
    const r = await baixarPesados({ cacheStorage: undefined, buscar: buscarOk() });
    expect(r.every((x) => x.estado === 'falhou' || x.estado === 'sem-fonte')).toBe(true);
  });

  it('📌 o nome da cache é versionado', () => {
    expect(CACHE_PESADOS).toMatch(/-v\d+$/);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. `if (!p.url) continue;` (saltar em silêncio em vez de devolver `sem-fonte`) → o [Zero] reprova. É a
//    mutação inteira: um subsistema por fazer passaria a parecer tratado, que é o defeito que o ADR-0119 mediu.
// 2. tirar o `.onnx.json` do catálogo → o [Right] reprova em DUAS asserções. Uma voz sem configuração desce
//    inteira e não fala.
// 3. tirar o `cache.match` (buscar sempre) → o [Boundary] reprova: 241 MB outra vez em todo arranque.
// 4. deixar a excepção subir em vez de a apanhar → o [Inverse] reprova, e o defeito real é maior do que o
//    caso: uma falha de rede derrubaria o arranque de um jogo por causa de um recurso que ele nem usa hoje.
// 5. 🔴 UM SEGUNDO ENDEREÇO NO CATÁLOGO (`const ESPELHO = 'https://cdn.jsdelivr.net/gh/rhasspy/piper-voices@main/'`
//    — o movimento exacto de quem liga o buscador e quer um espelho para a escola) → reprovam TRÊS, em três
//    ficheiros: o [Zero] daqui, o `nada-de-cdn-a-mao` e o `nada-vem-de-fora`. ⚠️ E as três reprovam por
//    razões diferentes — cópia, tecto do «sítio único», URL sem razão escrita —, que é o que separa três
//    gates de três cópias de um gate.
// 6. tirar a medição de UMA voz do `PESO_MEDIDO` → reprovam DOIS: o [Boundary] novo nomeia a voz, e o do peso
//    total acusa 241 → 181 MB. ⚠️ Sem o primeiro, o segundo sozinho só apanharia a falta enquanto o total
//    fosse conhecido: no dia em que uma quinta voz entrar, o número muda de propósito e alguém actualiza-o —
//    e a voz sem medição passaria despercebida DENTRO dessa actualização.

// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE DESCEU CHEGA A QUEM RESPONDE «QUE VOZ ESTÁ A CRIANÇA A OUVIR» — ADR-0110, gates 3 e 4.
//
// ========================= OS DOIS GATES QUE ESTE FICHEIRO PAGA, LIDOS DO REGISTO =========================
// · «A FETCH THAT FAILS IS REPORTED, not swallowed. The child falls back to eSpeak / Web Speech — and the
//    engine says WHICH VOICE IT IS ACTUALLY USING, because a fallback that presents itself as the real thing
//    is the `reflectTTS` family again.»
// · «THE FALLBACK SPEAKS WHILE THE MODEL DOWNLOADS — ADR-0065's clause, now load-bearing, so it needs a case
//    rather than a sentence.»
//
// 📏 E A METADE QUE FALTAVA NÃO ERA A REGRA: era a LIGAÇÃO. Medido antes de escrever uma linha — `vozEmUso`
// tinha **zero leitores em produção** e NADA no repositório produzia um `EstadosDasVozes`. O buscador que
// nasceu hoje relata `RelatorioPesado[]`. Duas linguagens para o mesmo facto, sem ponte, e as duas correctas
// — que é precisamente por que nenhum teste de nenhum dos lados podia acusar a falta.
//
// ⚠️ ISTO JÁ CUSTOU A ESTE REPOSITÓRIO: o `render/viz-axes` era o modelo inteiro dos dois eixos visuais, com
// 33 casos, e era ÓRFÃO. A composição existia no papel e não na tela.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { estadosDasVozes, idsDasVozes, vozEmUso } from '../app/js/platform/vozes-prontas.js';
import { VOZES_NEURAIS } from '../app/js/platform/voice-plan.js';

/** Um relatório do buscador, escrito como ele o devolve. */
const rel = (id, estado, erro) => ({ id, estado, ...(erro ? { erro } : {}) });
const AS_DUAS = (v, estado) => [rel(`voz:${v}`, estado), rel(`voz:${v}:cfg`, estado)];
const PT = 'pt_BR-faber-medium';

describe('a ponte entre o que desceu e o que a criança ouve', () => {
  it('🎯 [Zero] MODELO SEM CONFIGURAÇÃO NÃO É VOZ PRONTA — é a asserção inteira deste ficheiro', () => {
    // 🔴 O DEFEITO QUE ISTO IMPEDE É MUDO E PARECE SUCESSO: o piper recusa-se a falar sem o `.onnx.json`,
    // então uma voz com o modelo e sem a configuração ANUNCIA-SE como neural e não diz nada. A criança cega
    // carrega no botão e o jogo cala-se — sem erro, sem aviso, e com a interface a garantir que está tudo bem.
    // ⚠️ É pior do que a voz em falta, exactamente pela razão que o ADR-0119 mediu: a primeira parece tratada.
    const meia = [rel(`voz:${PT}`, 'baixado'), rel(`voz:${PT}:cfg`, 'falhou', 'HTTP 503')];
    const estados = estadosDasVozes(meia);

    expect(estados[PT], 'meia voz foi dada como pronta').toBe('falhou');
    expect(vozEmUso(estados, 'pt-BR'), 'a engine ofereceu uma voz que não fala')
      .toEqual({ tipo: 'recuo', porque: 'falhou' });
  });

  it('[Right] com os DOIS ficheiros, a voz fica pronta e a engine nomeia-a', () => {
    const estados = estadosDasVozes(AS_DUAS(PT, 'baixado'));
    expect(estados[PT]).toBe('pronta');
    // 📌 A engine DIZ QUAL — o gate 3 pede o nome e não um booleano: «a fallback that presents itself as the
    // real thing is the `reflectTTS` family». Um `true` não distingue faber de ryan nem de eSpeak.
    expect(vozEmUso(estados, 'pt-BR')).toEqual({ tipo: 'neural', voice: PT });
  });

  it('🎯 [Boundary] MODELO DESCIDO E CONFIGURAÇÃO A CAMINHO não é voz pronta — a janela real do buscador', () => {
    // 🔴 ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE, e o que ela achou não era um buraco de cobertura: era
    // o estado MAIS PROVÁVEL em produção a não estar medido. Trocar `every` por `some` na condição de
    // «pronta» passava os oito casos, porque em todos eles a metade que faltava estava FALHADA — e o ramo do
    // `falhou` responde antes. O que nenhum caso exercitava era a metade AINDA POR RELATAR.
    // ⚠️ E ela é inevitável: o buscador desce UM DE CADA VEZ (`platform/pesados`), primeiro o `.onnx` e depois
    // o `.onnx.json`. Entre os dois há sempre uma janela em que a voz tem modelo e não tem configuração — em
    // 60 MB de link de escola, uma janela de minutos. Com `some`, é nessa janela que a engine anuncia uma voz
    // neural que ainda não fala.
    const meiaACaminho = [rel(`voz:${PT}`, 'baixado')];

    expect(estadosDasVozes(meiaACaminho, { emCurso: true })[PT], 'anunciou pronta sem a configuração')
      .toBe('a-buscar');
    expect(vozEmUso(estadosDasVozes(meiaACaminho, { emCurso: true }), 'pt-BR').tipo)
      .toBe('recuo');
    // 📌 E com a descarga parada, o mesmo meio-estado é `ausente` e não `pronta`: a configuração não vem mais.
    expect(estadosDasVozes(meiaACaminho)[PT]).toBe('ausente');
  });

  it('📌 [Boundary] o que JÁ ESTAVA na cache conta como pronta — segundo dia, sem rede', () => {
    // O caso que o pilar 8 existe para servir: a criança volta no dia seguinte, offline, e a voz está lá.
    // `ja-tinha` é o estado que o buscador idempotente devolve nesse dia, e tratá-lo como «não desceu» faria
    // a engine recuar para a voz do sistema com o modelo no disco.
    const estados = estadosDasVozes(AS_DUAS(PT, 'ja-tinha'));
    expect(estados[PT]).toBe('pronta');
    expect(vozEmUso(estados, 'pt-BR').tipo).toBe('neural');
  });

  it('🎯 [Zero] GATE 4 · ENQUANTO DESCE, o recuo fala E DIZ QUE ESTÁ À ESPERA', () => {
    // ⚠️ `a-buscar` e não `ausente`, e a diferença é para um adulto: «ainda não pedimos» faz desligar a
    // espera, «vem a caminho» faz esperar. O `voice-plan` recusa-se a confundir as duas por escrito.
    const emCurso = estadosDasVozes([], { emCurso: true });
    expect(emCurso[PT]).toBe('a-buscar');
    expect(vozEmUso(emCurso, 'pt-BR'), 'a engine calou-se ou mentiu enquanto o modelo descia')
      .toEqual({ tipo: 'recuo', porque: 'a-buscar' });
  });

  it('🎯 [Zero] E O PAR: com a descarga TERMINADA, o que não desceu é `ausente`, nunca `a-buscar`', () => {
    // Sem este par, `emCurso` podia ser sempre verdadeiro e o caso acima ficava verde para sempre — a
    // interface prometeria eternamente uma voz que já não vem. É a mesma armadilha do gémeo silencioso.
    const parado = estadosDasVozes([]);
    expect(parado[PT]).toBe('ausente');
    expect(vozEmUso(parado, 'pt-BR')).toEqual({ tipo: 'recuo', porque: 'ausente' });
  });

  it('⚠️ [Zero] uma entrada SEM FONTE também derruba a voz — não é «ainda não desceu»', () => {
    const estados = estadosDasVozes([rel(`voz:${PT}`, 'sem-fonte', 'o identificador não se deixa ler'),
      rel(`voz:${PT}:cfg`, 'sem-fonte', 'idem')]);
    expect(estados[PT], 'sem fonte foi lido como pendente').toBe('falhou');
  });

  it('[Interface] as ids das vozes são DUAS por voz, e cobrem o catálogo', () => {
    const ids = idsDasVozes();
    expect(ids.length, 'quatro vozes são oito entradas').toBe(VOZES_NEURAIS.length * 2);
    expect(ids.filter((i) => i.endsWith(':cfg')).length).toBe(VOZES_NEURAIS.length);
    // 📌 O VÁCUO: sem isto, um catálogo vazio faria todos os casos acima medir o nada com ar de acordo.
    expect(VOZES_NEURAIS.length, 'o catálogo das vozes esvaziou').toBeGreaterThanOrEqual(4);
  });

  it('📌 [Right] o inglês tem DUAS vozes e uma pronta chega — a outra não é exigida', () => {
    // O ADR-0110 deixa em aberto QUAL das duas en-US a criança ouve por padrão. Este caso afirma só o que foi
    // decidido: uma pronta basta para não haver recuo. Exigir a segunda seria decidir por omissão.
    const soUma = estadosDasVozes(AS_DUAS('en_US-ryan-medium', 'baixado'), { emCurso: true });
    expect(vozEmUso(soUma, 'en-US')).toEqual({ tipo: 'neural', voice: 'en_US-ryan-medium' });
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. 🎯 `partes.some(falhou)` → `partes[0]` (olhar só o MODELO e ignorar a configuração) → o [Zero] reprova
//    nas duas asserções. É a mutação inteira deste ficheiro: com ela a engine anuncia uma voz que não fala.
// 2. 🔴 `every(baixado||ja-tinha)` → `some(...)` → **SOBREVIVEU À PRIMEIRA VOLTA, e o que ela achou não era
//    cobertura em falta: era o estado mais provável em produção a não estar medido.** Todos os casos que eu
//    tinha escrito punham a metade em falta como FALHADA, e o ramo do `falhou` responde antes — logo a
//    condição de «pronta» nunca era exercitada com uma metade POR RELATAR. Essa metade é a janela real do
//    buscador sequencial (`.onnx` primeiro, `.onnx.json` depois): minutos, num link de escola. Com o caso do
//    [Boundary] novo, a mutação morre.
//    ⚠️ E ela quase não chegou a ser aplicada: a primeira corrida usou `$M` e `$m` no PowerShell, que são a
//    MESMA variável, e as cinco «sobreviveram» sem nunca terem sido aplicadas. O guarda de contagem de
//    ocorrências não salva disso — o script nem correu. Ler o «8 passed» como resultado teria assinado cinco
//    mutações inexistentes.
// 3. tirar o `ja-tinha` da condição de pronta → o [Boundary] reprova, e o defeito é o segundo dia offline —
//    modelo no disco e a criança na voz do sistema.
// 4. `opcoes.emCurso ? 'a-buscar' : 'ausente'` → sempre `'a-buscar'` → o PAR reprova (e só ele), que é a
//    razão de o par existir: a promessa eterna de uma voz que já não vem.
// 5. `opcoes.emCurso ? … : …` → sempre `'ausente'` → o gate 4 reprova. As mutações 4 e 5 são opostas e
//    nenhuma das duas sobrevive, que é o que prova que a bandeira carrega peso nos DOIS sentidos.

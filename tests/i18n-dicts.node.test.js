// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of the locale DICTIONARIES (node project — none touches `document`).
//
// WHY THIS FILE EXISTS
// The accessibility layer is this project's product, and every screen-reader announcement goes through `t()` — or it
// would break on the second LANGUAGE before breaking on the second GAME. Three dictionaries that must agree are three
// copies, and this repository knows what happens to copies nobody forces to agree: three copies of the action→edge table
// drifted apart and broke climbing in Easy mode.
//
// So what is tested here is NOT translation (that is human judgement), it is STRUCTURE: the same keys, the same
// parameters, and the curriculum × frame boundary.
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const DICTS = { pt, en, es };
const TRADUZIDOS = { en, es }; // pt is the base dictionary; the other two fall back to it

/** The `{param}`s a sentence declares, in any order. */
const paramsDe = (frase) => new Set([...String(frase).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const chavesSr = Object.keys(pt).filter((k) => k.startsWith('sr.'));

describe('dicionários de locale — estrutura', () => {
  it('[Zero] pt é o dicionário-base e tem toda chave que os outros têm', () => {
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const orfas = Object.keys(d).filter((k) => !(k in pt));
      expect(orfas, `${nome} tem chave que pt não tem — o fallback não teria para onde cair`).toEqual([]);
    }
  });

  it('[Right] os TRÊS dicionários têm as MESMAS chaves — o fallback deixou de ser rotina', () => {
    // The fallback exists, and it is good that it does: a new key without a translation shows Portuguese instead of the
    // raw key. What it must not become is the NORMAL PATH, because then nobody notices a whole screen was left behind —
    // that is how an untranslated pause menu once went unnoticed (someone who chose English pressed Enter and saw
    // "Pausado").
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const faltando = Object.keys(pt).filter((k) => !(k in d));
      expect(faltando, `${nome} não traduziu estas chaves — traduza, ou explique aqui por que não`).toEqual([]);
    }
  });

  it('[Right] toda chave `sr.*` existe nos três idiomas', () => {
    // The rule is harder for `sr.*` than for the rest: a missing UI key falls back to pt and the person sees Portuguese in
    // the middle of English, which is ugly. A missing ANNOUNCEMENT falls into Portuguese in the ear of whoever depends on
    // the screen reader to play — and that person has no screen to break the tie.
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const faltando = chavesSr.filter((k) => !(k in d));
      expect(faltando, `${nome} não traduziu estes anúncios`).toEqual([]);
    }
  });

  it('[Right] os `{param}` de cada chave são os MESMOS nos três idiomas', () => {
    // A `{n}` forgotten in a translation breaks nothing: it vanishes silently and the sentence comes out without the number.
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
    // Except those that legitimately coincide — a bare number, an acronym, a proper noun. If one ever truly coincides, add
    // the key to the list WITH the reason, instead of loosening the assertion.
    // pt and es coincide WORD FOR WORD in the first two — not a forgotten translation, the same sentence in both languages.
    // Each entry needs its reason written; a list without reasons is loosening in disguise.
    const COINCIDEM_DE_PROPOSITO = new Set([
      'sr.visual.contrast', // identical in pt-BR and es
      'sr.visual.lq',       // likewise
      // '{slot}: {acao}.' — the frame here is only punctuation: both sides are parameters and arrive translated. It is a
      // key, and not a concatenation in code, because a language that reverses the order (action before position) must be
      // able to reverse it — and can only if the order lives in the dictionary.
      'sr.touch.slotSet',
      // the voice-engine announcement: the phrase is the same in pt-BR and es, word for word;
      // and the engine's name (Kokoro) is a proper noun that arrives through the parameter, untranslated.
      'sr.audio.engineSet',
      // the ASD-mode announcement — "TEA" (Transtorno do Espectro Autista / Trastorno del Espectro Autista) is the same
      // acronym in both languages, and the level arrives through the parameter, which is translated (calmo/calmado).
      'sr.icon.tea',
      // The control types spoken after a panel item's label (ADR-0159 rule 1): «interruptor» and «lista» are the same
      // word in pt-BR and es (RAE: interruptor, lista), not a copy left untranslated.
      'sr.papel.interruptor',
      'sr.papel.lista',
      // 'ok' — a loan from English that entered all three languages with the same spelling and sound. Translating it as
      // "de acordo"/"aceptar" would swap the word the child already recognises on the button for a longer, less familiar
      // one, right on the confirm cursor.
      'sr.quiz.ok',
      // '{efeito}: {nivel}.' — the frame is TWO parameters, a colon and a full stop. The CRT effect and the level arrive
      // translated; no word is left to translate. It is a key, not a concatenation, for the same reason as slotSet: a
      // language that must reverse the order can only do so if the order lives in the dictionary.
      'sr.crt.round',
      // "congelado" and "animado" are the SAME word in pt-BR and es, with the same spelling and meaning, and the target
      // arrives translated through the parameter. Same case as `sr.visual.contrast` above: a true coincidence between the
      // two languages, not a forgotten translation.
      'sr.rm.frozen', 'sr.rm.animated',
      // 'Sonar: {alvo} {lado}, {dist}.' — the frame is THREE parameters and punctuation. "Sonar" is a loan from English
      // with the same spelling in all three languages, and everything that carries meaning (target, side, distance)
      // arrives translated. It is a key, not a concatenation, for the same reason as slotSet: a language that announces
      // the distance before the side must be able to reverse it, and can only if the order lives in the dictionary.
      'sr.nav.sonarFound',
      // '{n} de {m}' — ADR-0044's position index. pt-BR and es write "6 de 10" with the SAME three parts: number, the
      // preposition `de`, number. No word is left to translate. English DIFFERS ('{n} of {m}'), which is exactly why the
      // frame lives in the dictionary instead of being concatenated in code.
      'sr.menu.index',
      // the voice-command announcement — «comando» and «voz» are written and said the same in pt-BR and es, and the state
      // arrives translated through the parameter («ligado» × «activado»). Same case as `sr.visual.contrast`: a true
      // coincidence. 📌 And the announcement repeats the icon's NAME on purpose (issue #184): the child hears the word they
      // read on the button — not «Jogar falando» about a button called «Comando de voz».
      'sr.icon.voice',
    ]);
    for (const [nome, d] of Object.entries(TRADUZIDOS)) {
      const iguais = chavesSr.filter((k) => k in d && d[k] === pt[k] && !COINCIDEM_DE_PROPOSITO.has(k));
      expect(iguais, `${nome} copiou o português nestas chaves`).toEqual([]);
    }
  });
});

describe('a fronteira currículo × moldura', () => {
  // THE RULE (the Dev, 2026-08-24 — see CLAUDE.md): the program's language is the INTERFACE's language, and it sets the
  // source language of the activities. THE PROMPT ALWAYS TRANSLATES — in a science activity as in a language one. The
  // only exception is LINGUISTIC CONTENT: the word, the letter, the syllable, the spelling and the Braille cell stay in
  // pt-BR, because they are the subject matter. Maths is NOT a language subject: `2 + 3` does not depend on language, so
  // the question "how much is 2 plus 3?" translates entirely, spelled-out operators included.
  //
  // Mechanically: the frame lives in the key, the content crosses through `{param}`.

  // Not a VOCABULARY sniff (`sílaba|soletr|grafema|fonema|braille`): under the Dev's narrower rule, a prompt saying the
  // game spells each option is legitimate, and sniffing the word would accuse the innocent. (A `\b` after the stem
  // `soletr` never even matched "soletra" or "soletração" — a stem that made the case unable to fail.)
  //
  // What stands is the MECHANICAL form of the rule, which is checkable: whoever announces curriculum content must
  // receive it through `{param}`. A key that talks about a word without having `{palavra}` embedded the content — and then
  // the translation would have to reproduce the word, precisely what the rule forbids.
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

  // THERE IS NO SECOND CASE HERE, and the absence is the result of two attempts, not forgetting.
  //
  // Asserting that no key EMBEDS a curriculum word was tried with a hand-written list (BABA, BOLA, CASA…) and by deriving
  // it from the curriculum's word list. Both fail for the same underlying reason: literacy curriculum words are VERY
  // COMMON Portuguese words — gato, bola, casa, lua, uva, dado, fogo. The first attempt already accused `fnot.desc.dec`,
  // which says "uma casa decimal" and has nothing to do with the curriculum.
  //
  // "The word CASA as subject matter" cannot be told from "casa" used in prose by looking at the dictionary alone.
  // Restricting to capitals would cover even less: the content arrives in lower case.
  //
  // So the rule's mechanical check is only the one above — content enters through `{param}`. A test that cannot be made
  // correct is not worth keeping in a weakened form that would look as if it covered what it does not. What was left
  // undone is written here, so nobody tries a third time without knowing about the first two.


  it('[Interface] chave que fala de jogador ou de tela carrega o número por parâmetro', () => {
    // What proves the frame was separated from the content: if the number were in the sentence, there would be one key
    // per number, and the translation would have to reproduce the arithmetic.
    const comNumero = chavesSr.filter((k) => /player\.|screens\.(alreadyN|activeN|newRoundN|wontFitN)|round\.multi/.test(k));
    // three left since the platformer's screen and round sentences moved to it (ADR-0174); it holds the same rule on them
    expect(comNumero.length).toBeGreaterThanOrEqual(3);
    for (const k of comNumero) expect(paramsDe(pt[k]), k).toContain('n');
  });
});

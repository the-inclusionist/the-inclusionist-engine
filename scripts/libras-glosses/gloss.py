# SPDX-License-Identifier: AGPL-3.0-or-later
#
# THE GLOSSER (ADR-0234, route A — plan item 5b): Portuguese in, Libras glosses out, with LAViD's `vlibras-translator` in its
# RULE-BASED mode. Run by `scripts/libras-glosses.mjs` inside the environment `uv.lock` pins, never by hand in a delivery.
#
#   stdin : {"texts": ["Jogador ZPARAMAZ entrou!", ...]}                  (UTF-8 JSON)
#   stdout: {"translator": "1.3.3", "spacy": "3.8.16", "model": "pt_core_news_md", "modelVersion": "3.8.0",
#            "mode": "rules", "glosses": ["JOGADOR ZPARAMAZ ENTRAR [EXCLAMAÇÃO]", ...],   (one gloss per text, same order)
#            "words": [[["Jogador", ["JOGADOR"]], ["ZPARAMAZ", ["ZPARAMAZ"]], ["entrou", ["ENTRAR", "ENTROU"]]], ...]}
#
# THE WORDS AS WRITTEN (ADR-0234, erratum «A WORD WITH NO SIGN IS SPELLED AS IT IS WRITTEN»): the translator returns lemmas, and a
# token with no sign is fingerspelled — so «entrou» would be spelled E-N-T-R-A-R. For each text, `words` lists the words the text
# WRITES (spaCy's tokens with a letter or digit, and the parts of a hyphenated one, since the translator splits at hyphens), each
# with the forms the translator's rules can turn it into, in capitals: the word itself, spaCy's lemma, the translator's own
# lookup lemma, with and without prepositions, and its singular. `scripts/libras-glosses.mjs` aligns each gloss token back to the
# word that produced it, and hands the player that written word where the delivery carries no sign. This script only reports
# what spaCy and the translator's lemmatizer know; the alignment, and what is done when it is ambiguous, is on the Node side,
# where the build's tests hold it without Python.
#
# 🔴 `neural=False`, ALWAYS: the neural mode fetches LAViD's `translator-models`, which declares no licence (ADR-0234).
# Exit codes the Node side turns into a sentence: 3 — spaCy's Portuguese model is not installed; 4 — the translator or spaCy
# is not installed; 2 — the input is not the JSON above.
import json
import sys

MODEL = "pt_core_news_md"


def written_words(doc, lemmatize, singular):
    """The words a text writes, each `[as written, [the forms the translator can make of it, in capitals]]`, in order."""
    words = []
    for token in doc:
        pieces = [token.text] + (token.text.split("-") if "-" in token.text else [])
        for index, piece in enumerate(pieces):
            if not any(ch.isalnum() for ch in piece):
                continue
            forms = {piece, lemmatize(piece), lemmatize(piece, exclude_prepositions=True), singular(piece)}
            if index == 0:  # the whole token: spaCy's own lemma and the lookup read in context
                forms |= {token.lemma_, lemmatize(token), lemmatize(token, exclude_prepositions=True)}
            words.append([piece, sorted({f.upper() for f in forms if f})])
    return words


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        request = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        texts = request["texts"]
        if not isinstance(texts, list) or not all(isinstance(t, str) for t in texts):
            raise ValueError("texts must be a list of strings")
    except (ValueError, KeyError, TypeError) as failure:
        print(f"the glosser's input is not {{\"texts\": [...]}}: {failure}", file=sys.stderr)
        return 2
    try:
        import spacy
        from vlibras_translator import translate
        from vlibras_translator.despluralize import PluralHandler
        from vlibras_translator.lemmatization import Lemmatizer
    except ImportError as failure:
        print(f"the translator is not installed in this environment: {failure}", file=sys.stderr)
        return 4
    try:
        from importlib.metadata import version

        model_version = version(MODEL.replace("_", "-"))
        translator = translate.Translator(model=MODEL)
        # the text as WRITTEN is parsed apart from the translator, which parses its own rewritten copy of it
        nlp = spacy.load(MODEL)
    except Exception as failure:  # the translator raises RuntimeError, importlib PackageNotFoundError, spaCy OSError
        print(f"spaCy's model {MODEL} is not installed in this environment: {failure}", file=sys.stderr)
        return 3
    glosses = [translator.translate(text, neural=False) or "" for text in texts]
    lemmatizer = Lemmatizer()
    words = [
        written_words(doc, lemmatizer.lemmatize, lambda w: PluralHandler.to_singular(w, lemmatizer))
        for doc in nlp.pipe(texts)
    ]
    json.dump(
        {
            "translator": translator.version,
            "spacy": spacy.__version__,
            "model": MODEL,
            "modelVersion": model_version,
            "mode": "rules",
            "glosses": glosses,
            "words": words,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

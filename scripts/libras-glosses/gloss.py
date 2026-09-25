# SPDX-License-Identifier: AGPL-3.0-or-later
#
# THE GLOSSER (ADR-0234, route A — plan item 5b): Portuguese in, Libras glosses out, with LAViD's `vlibras-translator` in its
# RULE-BASED mode. Run by `scripts/libras-glosses.mjs` inside the environment `uv.lock` pins, never by hand in a delivery.
#
#   stdin : {"texts": ["Jogador ZPARAMAZ entrou!", ...]}                  (UTF-8 JSON)
#   stdout: {"translator": "1.3.3", "spacy": "3.8.16", "model": "pt_core_news_md", "modelVersion": "3.8.0",
#            "mode": "rules", "glosses": ["JOGADOR ZPARAMAZ ENTRAR [EXCLAMAÇÃO]", ...]}  (one gloss per text, same order)
#
# 🔴 `neural=False`, ALWAYS: the neural mode fetches LAViD's `translator-models`, which declares no licence (ADR-0234).
# Exit codes the Node side turns into a sentence: 3 — spaCy's Portuguese model is not installed; 4 — the translator or spaCy
# is not installed; 2 — the input is not the JSON above.
import json
import sys

MODEL = "pt_core_news_md"


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
    except ImportError as failure:
        print(f"the translator is not installed in this environment: {failure}", file=sys.stderr)
        return 4
    try:
        from importlib.metadata import version

        model_version = version(MODEL.replace("_", "-"))
        translator = translate.Translator(model=MODEL)
    except Exception as failure:  # the translator raises RuntimeError, importlib PackageNotFoundError
        print(f"spaCy's model {MODEL} is not installed in this environment: {failure}", file=sys.stderr)
        return 3
    glosses = [translator.translate(text, neural=False) or "" for text in texts]
    json.dump(
        {
            "translator": translator.version,
            "spacy": spacy.__version__,
            "model": MODEL,
            "modelVersion": model_version,
            "mode": "rules",
            "glosses": glosses,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

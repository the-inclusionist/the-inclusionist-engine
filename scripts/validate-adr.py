#!/usr/bin/env python3
"""Validate the ADR records: they parse, and they match the shape they declare.

    python scripts/validate-adr.py docs/2-Architecture/adr

The index calls these records "machine-readable ... lint against a schema later".
This is that lint. It exists because for a long time nothing checked, and five of
twenty-six records did not parse at all while nobody noticed.

The third check is the one worth having. `- Decouple: a layer must place itself...`
is valid YAML: the `: ` turns the list item into a mapping, so the file loads
cleanly and the record simply holds the wrong data. No error, no symptom, wrong
content. Quote such items.

Two shapes are legal, per adr/README.md:
  full    — one decision weighed against named alternatives (the default)
  bundle  — `metadata.shape: bundle`, a consolidation of decisions already taken
            (ADR-0011..0018, from the retired REGISTRO-DE-DECISOES log). No
            considered-options, because none were ever weighed.
"""
from __future__ import annotations

import glob
import os
import sys

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is missing: pip install pyyaml")

META_KEYS = ["status", "date", "decision-makers", "consulted", "informed"]
FULL_KEYS = [
    "metadata", "title", "context-and-problem-statement", "decision-drivers",
    "considered-options", "pros-and-cons-of-the-options", "decision-outcome",
    "more-information",
]
BUNDLE_KEYS = [
    "metadata", "title", "context-and-problem-statement", "decision-outcome",
    "more-information",
]
# Lists that hold prose. A mapping here means a `: ` ate the sentence.
PROSE_LISTS = ["decision-drivers", "considered-options"]


def every_list_item(node, path=""):
    """(path, item) for every item of every list anywhere in the document."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield from every_list_item(value, f"{path}.{key}" if path else str(key))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield f"{path}[{index}]", value
            yield from every_list_item(value, f"{path}[{index}]")


def check(path):
    """Return a list of human-readable problems; empty means the record is sound."""
    try:
        doc = yaml.safe_load(open(path, encoding="utf-8"))
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        where = f" (line {mark.line + 1}, col {mark.column + 1})" if mark else ""
        return [f"does not parse: {getattr(exc, 'problem', exc)}{where}"]

    if not isinstance(doc, dict):
        return ["the document root is not a mapping"]

    problems = []
    metadata = doc.get("metadata")
    if not isinstance(metadata, dict):
        return ["`metadata` is missing or is not a mapping"]

    shape = metadata.get("shape", "full")
    if shape not in ("full", "bundle"):
        problems.append(f"metadata.shape is `{shape}`; expected `full` or `bundle`")
        shape = "full"

    for key in (BUNDLE_KEYS if shape == "bundle" else FULL_KEYS):
        if key not in doc:
            problems.append(f"missing `{key}` (shape: {shape})")
    for key in META_KEYS:
        if key not in metadata:
            problems.append(f"metadata is missing `{key}`")

    outcome = doc.get("decision-outcome")
    if isinstance(outcome, dict):
        if shape == "full":
            chosen = outcome.get("chosen-option")
            if not isinstance(chosen, dict) or not {"link", "justification"} <= set(chosen):
                problems.append("decision-outcome.chosen-option needs both `link` and `justification`")
            if "consequences" not in outcome:
                problems.append("decision-outcome is missing `consequences`")
            if "confirmation" not in outcome:
                problems.append("decision-outcome is missing `confirmation` — how would we know it worked?")
        elif "justification" not in outcome:
            problems.append("a bundle needs decision-outcome.justification")
    elif "decision-outcome" in doc:
        problems.append("`decision-outcome` is not a mapping")

    # The silent one: prose that YAML read as structure.
    for key in PROSE_LISTS:
        for index, item in enumerate(doc.get(key) or []):
            if isinstance(item, dict):
                culprit = next(iter(item), "?")
                problems.append(
                    f"{key}[{index}] became a MAPPING instead of text — a `: ` in "
                    f"{culprit[:40]!r} split the sentence. Quote the item."
                )
    for where, item in every_list_item(doc.get("pros-and-cons-of-the-options") or {}, "pros-and-cons"):
        if isinstance(item, dict) and not all(k in ("pros", "cons") for k in item):
            culprit = next(iter(item), "?")
            problems.append(f"{where} became a MAPPING instead of text ({culprit[:40]!r}). Quote the item.")
    return problems


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "docs/2-Architecture/adr"
    files = sorted(glob.glob(os.path.join(folder, "ADR-*.yaml")))
    if not files:
        sys.exit(f"no ADR-*.yaml found in {folder}")

    failed = 0
    for path in files:
        problems = check(path)
        if problems:
            failed += 1
            print(f"FAIL {os.path.basename(path)}")
            for problem in problems:
                print(f"       {problem}")
    print(f"\n{len(files)} records · {len(files) - failed} sound · {failed} with problems")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

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
import re
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

# ADR-0057: `metadata.status` is an ENUM and holds nothing else. The narrative moved to
# `superseded-by`, `supersedes`, `superseded-in-part` and `errata`.
STATUSES = ("proposed", "accepted", "deprecated", "superseded")

# A body that announces its own amendment while the metadata says nothing is the failure that
# actually happened: fifteen records were edited in place on 2026-08-28 and every `status` still
# read `accepted`, so an external diagnostic read one of them as current and it was not.
AMEND_MARKER = re.compile(r"(AMENDED|CORRECTED|COMPLETED 20|Settled 20|EMENDA|Emenda de)")

# ADR-0043 shape: a known debt gets a budget that ONLY GOES DOWN. These are the records that
# predate ADR-0057 and still carry the old form. Entries are REMOVED as the retrofit lands; a
# name that no longer needs to be here is itself a failure, so the list cannot rot upward.
STATUS_DEBT = {
    "ADR-0021-tts-npm-lib-and-r2-model.yaml",
    "ADR-0024-multi-repo-versioned-shared-packages.yaml",
    "ADR-0025-inclusionist-lab-hub-repo.yaml",
    "ADR-0034-progression-survives-the-restored-machine.yaml",
}
AMEND_DEBT = {
    "ADR-0001-integer-real-pixel-canvas-scale.yaml",
    "ADR-0008-multiplayer-scaling.yaml",
    "ADR-0010-non-negotiable-pillars.yaml",
    "ADR-0011-visual-accessibility.yaml",
    "ADR-0012-typography.yaml",
    "ADR-0020-canonical-z-order-and-post-fx.yaml",
    "ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml",
    "ADR-0024-multi-repo-versioned-shared-packages.yaml",
    "ADR-0027-inclusionist-pixel-engine.yaml",
    "ADR-0033-engine-entity-and-modal-input.yaml",
    "ADR-0036-this-repository-becomes-the-engine.yaml",
    "ADR-0045-the-run-button-becomes-a-latch-and-its-other-jobs-move-to-the-jump.yaml",
    "ADR-0049-every-reward-is-deterministic-and-the-only-celebration-is-growth.yaml",
    "ADR-0050-two-control-surfaces-and-the-clock-belongs-to-the-adult.yaml",
    # not a debt: this record NAMES the markers in order to forbid them.
    "ADR-0057-a-record-changes-by-supersession-and-errata-is-the-only-edit-in-place.yaml",
}


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

    # --- ADR-0057: how a record is allowed to change -------------------------
    name = os.path.basename(path)
    status = metadata.get("status")
    if status not in STATUSES and name not in STATUS_DEBT:
        problems.append(
            f"metadata.status is {str(status)[:60]!r}; it must be one of {'/'.join(STATUSES)}. "
            "The narrative goes in `superseded-by`, `supersedes`, `superseded-in-part` or `errata` (ADR-0057)."
        )
    if status == "superseded" and not metadata.get("superseded-by"):
        problems.append("status is `superseded` with no `superseded-by` — a dead end for the reader (ADR-0057)")

    if AMEND_MARKER.search(open(path, encoding="utf-8").read()) and name not in AMEND_DEBT:
        declared = {"errata", "superseded-in-part", "superseded-by"} & set(metadata)
        if not declared:
            problems.append(
                "the body announces an amendment (AMENDED/CORRECTED/COMPLETED/Settled) and the metadata "
                "declares none. Either it is an ERRATUM (add `errata`) or the decision changed and needs a "
                "superseding record (ADR-0057)"
            )
    return problems


def number(path):
    """`ADR-0058` from `.../ADR-0058-five-systems-....yaml`, or None if unparseable."""
    stem = os.path.basename(path)
    return stem[:8] if stem[:4] == "ADR-" and stem[4:8].isdigit() else None


def pointer_problems(files):
    """Cross-file: a supersession is a PAIR, and half of one is worse than none.

    A reader arrives from whichever side they happen to hold. `superseded-by` alone leaves the
    successor silent about what it replaced; `supersedes` alone leaves the old record still
    claiming to govern. Both directions are checked (ADR-0057).
    """
    meta, problems = {}, {}
    for path in files:
        name = number(path)
        if not name:
            continue
        doc = yaml.safe_load(open(path, encoding="utf-8")) or {}
        meta[name] = (path, doc.get("metadata") or {})

    def note(path, text):
        problems.setdefault(path, []).append(text)

    for name, (path, m) in meta.items():
        target = m.get("superseded-by")
        if target:
            if target not in meta:
                note(path, f"`superseded-by: {target}` names a record that does not exist")
            elif name not in (meta[target][1].get("supersedes") or []):
                note(path, f"`superseded-by: {target}`, but {target} does not list {name} in `supersedes`")
        for replaced in m.get("supersedes") or []:
            if replaced not in meta:
                note(path, f"`supersedes` names {replaced}, which does not exist")
            elif meta[replaced][1].get("superseded-by") != name:
                note(path, f"`supersedes: {replaced}`, but {replaced} does not point back with `superseded-by: {name}`")

        # Partial supersession is a pair too, and it is the EASIER one to leave half-done:
        # nothing about the old record's status changes, so a missing mirror is invisible.
        for entry in m.get("superseded-in-part") or []:
            by = entry.get("by") if isinstance(entry, dict) else entry
            if by not in meta:
                note(path, f"`superseded-in-part` names {by}, which does not exist")
            elif name not in (meta[by][1].get("supersedes-in-part") or []):
                note(path, f"`superseded-in-part: {by}`, but {by} does not list {name} in `supersedes-in-part`")
            elif isinstance(entry, dict) and not entry.get("what"):
                note(path, f"`superseded-in-part: {by}` does not say WHAT part — the reader cannot tell which "
                           "clauses still govern (ADR-0057)")
        for replaced in m.get("supersedes-in-part") or []:
            if replaced not in meta:
                note(path, f"`supersedes-in-part` names {replaced}, which does not exist")
            else:
                back = meta[replaced][1].get("superseded-in-part") or []
                if not any((e.get("by") if isinstance(e, dict) else e) == name for e in back):
                    note(path, f"`supersedes-in-part: {replaced}`, but {replaced} does not point back")
    return problems


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "docs/2-Architecture/adr"
    files = sorted(glob.glob(os.path.join(folder, "ADR-*.yaml")))
    if not files:
        sys.exit(f"no ADR-*.yaml found in {folder}")

    crossed = pointer_problems(files)
    failed = 0
    for path in files:
        problems = check(path) + crossed.get(path, [])
        if problems:
            failed += 1
            print(f"FAIL {os.path.basename(path)}")
            for problem in problems:
                print(f"       {problem}")
    print(f"\n{len(files)} records · {len(files) - failed} sound · {failed} with problems")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

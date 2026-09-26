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

# 🔴 THE ROOT AGAINST WHICH `confirmed-by` IS CHECKED, and it used to be `os.getcwd()` written into the middle of the comparison.
#
# 📏 MEASURED ON 2026-09-09, running this validator from OUTSIDE the repository: 122 records, **113 sound and 9 with
# problems** — and the nine were the nine that have `confirmed-by`. No defect in the records: the comparison
# resolved paths against the folder someone called the command from, and nobody had declared that it did.
#
# ⚠️ AND THE MEASUREMENT IS WORTH MORE THAN THE FIX, because it draws the boundary of an open decision (the
# Dev's proposal of a repository just for the ADR tree): the check of SHAPE travels — 113 passed
# outside the tree — and the check of CONSTRUCTION does not travel, because it needs the code beside it. They are nine
# records, and they are exactly the ones that cannot move house without losing what confirms them.
#
# 📌 The default is still the `cwd`, so that no caller of today changes behaviour; what changes is that the
# root becomes DECLARABLE (`--root=…`) and is STATED in the failure message. A missing path stops looking
# like a lying record when it is only the command running from the wrong place.
RAIZ = os.getcwd()

# 🔴 AND SINCE THE MOVE, A PATH CAN LIVE IN ANOTHER REPOSITORY. `confirmed-by: engine:app/js/x.ts`
# says TWO things — which artefact confirms the record, and where it lives —, and the second became necessary
# on the day the records stopped living beside the code (ADR-0123).
#
# ⚠️ WITHOUT THAT REPOSITORY'S ROOT, THE CHECK DOES NOT HAPPEN — and that is what has to show. A sieve that
# checks nothing and prints «tudo são» is worse than not existing: it is the exact shape of the false report
# this project has already caught three times. So what is not checked is COUNTED and STATED at the end, per
# repository, on every run. The root is passed with `--repo engine=../SP-the-inclusionist-tracer`.
RAIZES = {}
NAO_CONFERIDOS = {}

# 🔴 THE PREFIXES THAT EXIST. ADR-0123 closed by saying this could not be paid for — «nada confere que
# `engine:` ainda nomeia um repositório real» — and the sentence was WRONGLY FRAMED. A prefix is not the name of a
# repository on GitHub: it is a LABEL that someone binds to a root with `--repo`. Renaming the repository does not
# break it; what breaks it is writing a label that no `--repo` ever supplies.
#
# ⚠️ AND THAT IS THE CASE THAT PASSES FOR NORMAL: `enigne:app/js/x.ts` in a record would be counted as «não
# conferido», which is exactly what a run without the root prints every day. The typo would go on
# living inside the message that exists to say everything is fine.
#
# 📌 A declared list solves it and costs one line per repository: a known prefix without a root is COUNTED;
# an unknown prefix is a PROBLEM. Adding a repository to this list is the act of admitting it.
# 🔴 `docs` ENTERED ON 2026-09-09, and what forced it was the DIVERGENT VERDICT this list exists to
# prevent. ADR-0126 was confirmed by `scripts/divida-dos-registos.py` WITHOUT a prefix, and a path without a prefix
# resolves against the repository it is run from: the docs CI opened it and passed, the run from the
# engine looked for it in the wrong tree and failed. The same tree, green on one side and red on the other, with
# nothing to say which was right — which is exactly the defect of `9d4a5e3`, now coming from the DATA instead of
# the tool. 📌 A path without a prefix comes to mean «o repositório de onde se corre», and that is only
# safe for a record that lives with the code it names; everything else is declared.
# 📌 `game-platformer` ENTERED ON 2026-09-23 with the six records that are its own (ADR-0229): its tree cites
# records that stayed here, and the index here points at the ones that went there.
REPOS_CONHECIDOS = {"engine", "docs", "game-platformer"}
MOVIDOS_NAO_CONFERIDOS = {}
# 🔴 A SUPERSESSION PAIR CAN CROSS A REPOSITORY (ADR-0242): the engine's records went home and the project-wide ones
# stayed in `docs`, and nine pairs had one half on each side — ADR-0051 supersedes part of ADR-0010, ADR-0123 part of
# ADR-0068. The other half is read from the tree `--repo` declares and checked like a local one; when only an index
# row knows where it lives, the pair is COUNTED and SAID, by the same rule as a `confirmed-by` in another repository.
PARES_NAO_CONFERIDOS = {}

# ADR-0057 says how a record CHANGES. `confirmed-by` says something else, which was missing: whether it was BUILT.
#
# The distinction appeared in issue #95. ADR-0053 closes with «⚠️ NOT YET BUILT. This record is the decision; the
# script is its issue» — true on the day it was written, and false on the day the script was born. It is not an
# erratum (the author, with that day's facts, would have written exactly that) nor a supersession (the decision
# did not change): it is a STATE line that aged, and ADR-0057 has no form for it.
#
# ⚠️ THE PROSE OF THE `confirmation` IS NOT REWRITTEN. It is historical and stays as it was; `confirmed-by` is
# today's fact, and it lives in the METADATA, which in a YADR is the first thing one reads. So the record says
# both true things at once — what was decided, and that it already exists — without either of them lying.
#
# What the machine comes to know: the difference between «decidido» and «decidido e construído». Every listed path
# MUST EXIST, and that is where the key pays its own cost — it was measured on 2026-09-07 that three open issues
# pointed at files that had left with the cartridge, and nothing said so. A `confirmed-by` pointing at a
# deleted gate would be the same thing, in an accepted record.
CONFIRMED_BY = "confirmed-by"
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
# ZEROED on 2026-09-04. The four records that kept prose in `status` were split into the
# fields of ADR-0057. The list stays, empty: a budget that reached zero and disappears stops proving
# that it got there, and the next entry has to be a decision and not an oversight.
STATUS_DEBT = set()
# ZEROED on 2026-09-04, a week after it was created with fourteen names. Every entry left by
# classification — erratum, supersession, or a fix to the gate itself — and none by being tolerated.
# The list stays, empty, for the same reason as STATUS_DEBT: a budget that reaches zero and disappears stops
# proving that it got there.
AMEND_DEBT = set()


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

    # --- issue #95: the machine knows the difference between decided and BUILT --------------------
    if CONFIRMED_BY in metadata:
        alvos = metadata[CONFIRMED_BY]
        if not isinstance(alvos, list) or not alvos:
            problems.append(f"`{CONFIRMED_BY}` must be a non-empty list of repository paths")
        else:
            for alvo in alvos:
                if not isinstance(alvo, str):
                    problems.append(f"`{CONFIRMED_BY}` holds {type(alvo).__name__}; every entry is a path")
                else:
                    repo, _, resto = alvo.partition(":")
                    if not resto:                       # no prefix: the path belongs to this repository
                        repo, resto = "", alvo
                    if repo and repo not in REPOS_CONHECIDOS:
                        problems.append(
                            f"`{CONFIRMED_BY}` names {alvo}, and `{repo}:` is not a declared repository "
                            f"(known: {', '.join(sorted(REPOS_CONHECIDOS))}) — an undeclared prefix is "
                            "counted as «not checked», which is what a normal run prints, so a typo would "
                            "live inside the message that says everything is fine"
                        )
                    elif repo and repo not in RAIZES:
                        NAO_CONFERIDOS[repo] = NAO_CONFERIDOS.get(repo, 0) + 1
                    elif not os.path.exists(os.path.join(RAIZES.get(repo, RAIZ), resto)):
                        onde = RAIZES.get(repo, RAIZ)
                        problems.append(
                            f"`{CONFIRMED_BY}` names {alvo}, which does not exist under {onde} — a record "
                            "that says it was built, pointing at nothing, is worse than one that says nothing"
                        )
        # A PROPOSAL cannot be confirmed: what has not been decided yet cannot have been built, and a
        # record in that state is either a proposal that ran ahead, or a forgotten `status`.
        if status == "proposed":
            problems.append(f"status is `proposed` and carries `{CONFIRMED_BY}` — a proposal cannot be built yet")

    # `proposed` is still being written: the immutability rule binds ACCEPTED records (ADR-0057), so a
    # proposal that shows its working is doing the right thing.
    if (status != "proposed"
            and AMEND_MARKER.search(open(path, encoding="utf-8").read())
            and name not in AMEND_DEBT):
        # `supersedes` and `supersedes-in-part` count: a body that says `AMENDED here` is announcing what THIS
        # record does to ANOTHER, and the metadata that declares it is the outgoing pointer, not an erratum.
        declared = {"errata", "superseded-in-part", "superseded-by",
                    "supersedes", "supersedes-in-part"} & set(metadata)
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


def other_trees(folder):
    """Every record number another DECLARED repository answers for: its ADR files and its index rows.

    Only `--repo` roots are read, never a guessed sibling folder: a tree the caller did not name is a tree
    nobody promised is the right one. The folder being validated is skipped, so declaring the repository
    you run from (`--repo docs=.`) cannot make a record vouch for itself.
    """
    here = os.path.abspath(folder) if folder else ""
    found = {}
    for repo, root in sorted(RAIZES.items()):
        tree = os.path.join(root, "docs", "2-Architecture", "adr")
        if os.path.abspath(tree) == here or not os.path.isdir(tree):
            continue
        for path in glob.glob(os.path.join(tree, "ADR-*.yaml")):
            if number(path):
                found.setdefault(number(path), repo)
        index = os.path.join(tree, "README.md")
        if os.path.exists(index):
            with open(index, encoding="utf-8") as fh:
                # A row whose link names another repository answers for THAT repository, not for the one whose
                # index holds it: the pair checks below say where to look, and the tree that knows is the right name.
                for mt in re.finditer(r"(?m)^\| \[(ADR-\d{4})\](?:\(([a-z][a-z0-9-]*):)?", fh.read()):
                    found.setdefault(mt.group(1), mt.group(2) or repo)
    return found


def other_metadata(folder):
    """The metadata of every record in another DECLARED tree, for the supersession pairs that cross a repository.

    The same trees `other_trees` reads and no others. A record there that does not parse is left to that tree's own
    run, which names it with its line and column.
    """
    here = os.path.abspath(folder) if folder else ""
    found = {}
    for repo, root in sorted(RAIZES.items()):
        tree = os.path.join(root, "docs", "2-Architecture", "adr")
        if os.path.abspath(tree) == here or not os.path.isdir(tree):
            continue
        for path in sorted(glob.glob(os.path.join(tree, "ADR-*.yaml"))):
            name = number(path)
            if not name or name in found:
                continue
            try:
                doc = yaml.safe_load(open(path, encoding="utf-8")) or {}
            except yaml.YAMLError:
                continue
            found[name] = (repo, doc.get("metadata") or {})
    return found


def pointer_problems(files):
    """Cross-file: a supersession is a PAIR, and half of one is worse than none.

    A reader arrives from whichever side they happen to hold. `superseded-by` alone leaves the
    successor silent about what it replaced; `supersedes` alone leaves the old record still
    claiming to govern. Both directions are checked (ADR-0057).
    """
    meta, problems = {}, {}
    folder = os.path.dirname(files[0]) if files else ""
    # 🔴 UNDER N TREES A CITATION CAN LIVE ELSEWHERE (ADR-0226 §3, ADR-0229). A record that moved to a game still
    # cites the records that stayed, and the ones that stayed still cite it. Two places answer «where is this
    # number?»: the ADR tree of every repository the caller DECLARED with `--repo`, and a row of this tree's own
    # index whose link names another repository — `| [ADR-0062](game-platformer:docs/…/ADR-0062-….yaml) |`, the
    # same `repo:path` shape a `confirmed-by` already uses, so renaming a repository does not break it.
    elsewhere = other_trees(folder)
    index_path = os.path.join(folder, "README.md") if folder else None
    index_text = ""
    if index_path and os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as fh:
            index_text = fh.read()
    moved = {mt.group(1): (mt.group(2), mt.group(3))
             for mt in re.finditer(r"(?m)^\| \[(ADR-\d{4})\]\(([a-z][a-z0-9-]*):([^)]+)\)", index_text)}
    for path in files:
        name = number(path)
        if not name:
            continue
        try:
            doc = yaml.safe_load(open(path, encoding="utf-8")) or {}
        except yaml.YAMLError:
            # `check` reports this file as unparseable with the line and column. Crashing here
            # instead would replace 68 verdicts with one traceback, which is the classic way a
            # gate stops gating: it looks broken rather than red, and somebody skips it.
            continue
        meta[name] = (path, doc.get("metadata") or {})

    def note(path, text):
        problems.setdefault(path, []).append(text)

    far = other_metadata(folder)

    def other_half(target):
        """Where the other half of a pair lives: `("", metadata)` in this tree, `(repo, metadata)` in a declared
        tree, `(repo, None)` when only an index row knows the repository, and `(None, None)` when nothing does."""
        if target in meta:
            return "", meta[target][1]
        if target in far:
            return far[target]
        repo = moved[target][0] if target in moved else elsewhere.get(target)
        return (repo, None) if repo else (None, None)

    def there(repo):
        return f" (in `{repo}:`)" if repo else ""

    def uncounted(repo):
        PARES_NAO_CONFERIDOS[repo] = PARES_NAO_CONFERIDOS.get(repo, 0) + 1

    for name, (path, m) in meta.items():
        target = m.get("superseded-by")
        if target:
            repo, other = other_half(target)
            if repo is None:
                note(path, f"`superseded-by: {target}` names a record that does not exist")
            elif other is None:
                uncounted(repo)
            elif name not in (other.get("supersedes") or []):
                note(path, f"`superseded-by: {target}`, but {target}{there(repo)} does not list {name} in `supersedes`")
        for replaced in m.get("supersedes") or []:
            repo, other = other_half(replaced)
            if repo is None:
                note(path, f"`supersedes` names {replaced}, which does not exist")
            elif other is None:
                uncounted(repo)
            elif other.get("superseded-by") != name:
                note(path, f"`supersedes: {replaced}`, but {replaced}{there(repo)} does not point back with "
                           f"`superseded-by: {name}`")

        # Partial supersession is a pair too, and it is the EASIER one to leave half-done:
        # nothing about the old record's status changes, so a missing mirror is invisible.
        for entry in m.get("superseded-in-part") or []:
            by = entry.get("by") if isinstance(entry, dict) else entry
            repo, other = other_half(by)
            if repo is None:
                note(path, f"`superseded-in-part` names {by}, which does not exist")
            elif other is not None and name not in (other.get("supersedes-in-part") or []):
                note(path, f"`superseded-in-part: {by}`, but {by}{there(repo)} does not list {name} in "
                           "`supersedes-in-part`")
            elif isinstance(entry, dict) and not entry.get("what"):
                note(path, f"`superseded-in-part: {by}` does not say WHAT part — the reader cannot tell which "
                           "clauses still govern (ADR-0057)")
            if repo and other is None:
                uncounted(repo)
        # A reference to a record that does not exist is worse than none: it reads as answered.
        # Found by accident in ADR-0010, which sent the reader to ADR-0052 for the Libras levels
        # decided in ADR-0051 — one digit, and the reader arrives at `professionals author activities`.
        # ⚠️ A citation found in no tree still FAILS, and never becomes «not checked»: counting it would let the
        # ADR-0052 typo above live inside the message that says everything is fine. What the caller can do about
        # it is said in the failure itself.
        for cited in sorted(set(re.findall(r"ADR-\d{4}", open(path, encoding="utf-8").read()))):
            if cited in meta or cited == name or cited in elsewhere or cited in moved:
                continue
            declared = ", ".join(sorted(RAIZES)) or "none"
            note(path, f"cites {cited}, which is in neither this tree nor any tree declared with `--repo` "
                       f"(declared: {declared}) — a record in another repository is found by declaring it")

        for replaced in m.get("supersedes-in-part") or []:
            repo, other = other_half(replaced)
            if repo is None:
                note(path, f"`supersedes-in-part` names {replaced}, which does not exist")
            elif other is None:
                uncounted(repo)
            else:
                back = other.get("superseded-in-part") or []
                if not any((e.get("by") if isinstance(e, dict) else e) == name for e in back):
                    note(path, f"`supersedes-in-part: {replaced}`, but {replaced}{there(repo)} does not point back")

    # 🔴 THE INDEX IS THE DOOR, AND IT DRAINS IN SILENCE. Measured on 2026-09-09: 133 records on disk and 126
    # rows in `README.md` — the last seven never got in, one at a time, without anything saying so.
    # A record outside the index exists only for whoever already knows its number, and nobody who needs it does.
    # ⚠️ The question is «tem LINHA», not «é mencionado»: a record cited inside the prose of another row
    # would show up to a `grep` and still have no entry of its own — which is how the seven hid.
    # 📌 The folder comes from the record ITSELF and not from a global variable: the index lives beside the files
    # it indexes, and deriving it from here is what stops this case from measuring the folder someone ran from.
    # 📌 AND A ROW THAT SAYS «MUDOU-SE» IS A POINTER LIKE THE OTHERS (ADR-0229): the file has to be on the other
    # side, and cannot also remain on this one. Without that repository's root the row is COUNTED, by the rule above.
    for moved_name, (repo, rel) in sorted(moved.items()):
        if moved_name in meta:
            note(meta[moved_name][0], f"has a file here AND an index row saying it moved to `{repo}:` — one of the "
                                      "two is stale, and a reader cannot tell which")
        elif repo not in REPOS_CONHECIDOS:
            note(index_path, f"the row for {moved_name} points at `{repo}:`, which is not a declared repository "
                             f"(known: {', '.join(sorted(REPOS_CONHECIDOS))})")
        elif repo not in RAIZES:
            MOVIDOS_NAO_CONFERIDOS[repo] = MOVIDOS_NAO_CONFERIDOS.get(repo, 0) + 1
        elif number(rel) != moved_name or not os.path.exists(os.path.join(RAIZES[repo], rel)):
            note(index_path, f"the row for {moved_name} says it moved to {repo}:{rel}, and that file is not "
                             f"there under {RAIZES[repo]}")

    if meta and index_text:
        linhas = {mt.group(1) for mt in re.finditer(r"(?m)^\| \[(ADR-\d{4})\]", index_text)}
        for name, (path, _m) in sorted(meta.items()):
            if name not in linhas:
                note(path, "has no row in the index `README.md` — a record outside the index is reachable "
                           "only by someone who already knows its number, and nobody who needs it does")
    return problems


def main():
    global RAIZ
    # ⚠️ ONE PASS ONLY, and the value of `--repo` is consumed HERE. The first version filtered the options with a
    # `startswith("--")` and then read them in another loop — and the `engine=…` of `--repo engine=…` does not start
    # with a dash, so it ended up in the list of positional arguments and was read as the records' FOLDER.
    args = []
    resto = list(sys.argv[1:])
    while resto:
        flag = resto.pop(0)
        if flag.startswith("--root="):
            RAIZ = flag[len("--root="):]
        elif flag == "--repo" and resto:
            nome, _, caminho = resto.pop(0).partition("=")
            if caminho:
                RAIZES[nome] = caminho
        elif flag.startswith("--repo="):
            nome, _, caminho = flag[len("--repo="):].partition("=")
            if caminho:
                RAIZES[nome] = caminho
        elif not flag.startswith("--"):
            args.append(flag)
    folder = args[0] if args else "docs/2-Architecture/adr"
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
    # The index is not a record, so its failures are printed apart and never counted as one — but they fail
    # the run all the same: a row pointing at nothing is the same lie as a `confirmed-by` pointing at nothing.
    index_failed = 0
    for path in sorted(set(crossed) - set(files)):
        index_failed += 1
        print(f"FAIL {os.path.basename(path)}")
        for problem in crossed[path]:
            print(f"       {problem}")
    print(f"\n{len(files)} records · {len(files) - failed} sound · {failed} with problems")
    # 🔴 WHAT WAS NOT CHECKED IS STATED, ALWAYS. Without this line, a repository that only holds the records
    # would print «tudo são» without having opened a single artefact — and that is the difference between a sieve
    # and a rubber stamp. Pass `--repo engine=<path>` to really check it.
    for repo in sorted(NAO_CONFERIDOS):
        print(f"⚠️  {NAO_CONFERIDOS[repo]} `confirmed-by` paths in `{repo}` NOT checked "
              f"— pass `--repo {repo}=<path>` to check them")
    for repo in sorted(MOVIDOS_NAO_CONFERIDOS):
        print(f"⚠️  {MOVIDOS_NAO_CONFERIDOS[repo]} index rows moved to `{repo}` NOT checked "
              f"— pass `--repo {repo}=<path>` to check them")
    for repo in sorted(PARES_NAO_CONFERIDOS):
        print(f"⚠️  {PARES_NAO_CONFERIDOS[repo]} supersession pointers into `{repo}` NOT checked "
              f"— pass `--repo {repo}=<path>` to check them")
    return 1 if failed or index_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

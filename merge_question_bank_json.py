"""Merge multiple independently edited question-bank JSON files.

Designed for the workflow where multiple editors each edit different sections using
bank_edit.html, then you want to merge their outputs back into one.

Key behavior:
- Uses the "title" of each section (English/Punjabi) to create a stable section id.
- Replaces whole sections when they differ from the base.
- Detects conflicts when two edited files change the same section differently.
- Appends and de-duplicates section_updates entries.

Typical usage:
  python merge_question_bank_json.py --base Question_Bank.json --out merged.json editor1.json editor2.json

You can also run without --base:
  python merge_question_bank_json.py --out merged.json editor1.json editor2.json
In that case, the first edited file is treated as the base.

This script does not require any third-party packages.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


def _safe_text(v: Any) -> str:
    return "" if v is None else str(v)


def _normalize_key(s: Any) -> str:
    return " ".join(_safe_text(s).strip().lower().split())


def _normalize_bilingual(v: Any) -> Dict[str, str]:
    if isinstance(v, dict):
        return {"en": _safe_text(v.get("en")), "pa": _safe_text(v.get("pa"))}
    return {"en": _safe_text(v), "pa": ""}


def make_section_id(title: Any) -> str:
    """Match the JS makeSectionId() logic in js/bank_common.js."""
    t = _normalize_bilingual(title)
    key = f"{_normalize_key(t['en'])}|{_normalize_key(t['pa'])}"
    h = 0
    for ch in key:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
    # mimic JS bitwise |0 signed conversion: if high bit set, treat as negative
    if h & 0x80000000:
        h = -((~h + 1) & 0xFFFFFFFF)
    return "sec_" + base36(abs(h))


_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"


def base36(n: int) -> str:
    if n == 0:
        return "0"
    out = []
    while n:
        n, r = divmod(n, 36)
        out.append(_ALPHABET[r])
    return "".join(reversed(out))


def validate_bank_shape(obj: Any) -> None:
    if not isinstance(obj, dict) or not isinstance(obj.get("sections"), list):
        raise ValueError("Invalid bank: missing sections[]")
    for sec in obj["sections"]:
        if not isinstance(sec, dict) or not isinstance(sec.get("questions"), list):
            raise ValueError("Invalid bank: section missing questions[]")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _stable_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _parse_iso(dt: str) -> Optional[datetime]:
    try:
        # Handles Z suffix too (Python 3.11+ can parse it; for older, normalize)
        if dt.endswith("Z"):
            dt = dt[:-1] + "+00:00"
        return datetime.fromisoformat(dt)
    except Exception:
        return None


def _update_key(u: Dict[str, Any]) -> Tuple[Any, ...]:
    # Enough to dedupe entries across files when everyone started from the same base.
    return (
        u.get("at"),
        u.get("editor"),
        u.get("action"),
        u.get("section"),
        u.get("section_index"),
        u.get("question_number"),
        u.get("question_index"),
    )


@dataclass
class Conflict:
    section_id: str
    section_title: str
    first_source: str
    second_source: str


def _section_title_display(title: Any) -> str:
    t = _normalize_bilingual(title)
    en = t["en"].strip()
    pa = t["pa"].strip()
    if en and pa:
        return f"{en} / {pa}"
    return en or pa or "(Untitled section)"


def merge_banks(base: Dict[str, Any], edited_banks: List[Tuple[str, Dict[str, Any]]]) -> Tuple[Dict[str, Any], List[Conflict]]:
    """Return merged bank + conflicts."""

    merged = json.loads(json.dumps(base))  # deep clone
    validate_bank_shape(merged)

    base_by_id = {make_section_id(s.get("title")): s for s in merged.get("sections", [])}

    # We'll keep merged sections in original order where possible.
    merged_section_ids_in_order = [make_section_id(s.get("title")) for s in merged.get("sections", [])]

    # Track which file last modified each section.
    section_source: Dict[str, str] = {sid: "--base--" for sid in base_by_id.keys()}
    conflicts: List[Conflict] = []

    # Merge section_updates (dedupe)
    merged_updates: List[Dict[str, Any]] = []
    seen_updates = set()

    def add_updates(from_bank: Dict[str, Any]) -> None:
        updates = from_bank.get("section_updates")
        if not isinstance(updates, list):
            return
        for u in updates:
            if not isinstance(u, dict):
                continue
            k = _update_key(u)
            if k in seen_updates:
                continue
            seen_updates.add(k)
            merged_updates.append(u)

    add_updates(merged)

    for source_name, edited in edited_banks:
        validate_bank_shape(edited)

        edited_by_id = {make_section_id(s.get("title")): s for s in edited.get("sections", [])}

        # Determine deletions only if the edited file claims deletions.
        delete_actions = [u for u in (edited.get("section_updates") or []) if isinstance(u, dict) and u.get("action") == "delete_section"]
        if delete_actions:
            missing_ids = set(base_by_id.keys()) - set(edited_by_id.keys())
            for sid in missing_ids:
                # only delete if that section still exists in merged
                if sid in base_by_id:
                    del base_by_id[sid]
                    if sid in merged_section_ids_in_order:
                        merged_section_ids_in_order = [x for x in merged_section_ids_in_order if x != sid]

        # Add/replace sections
        for sid, edited_section in edited_by_id.items():
            if sid not in base_by_id:
                # New section
                base_by_id[sid] = edited_section
                merged_section_ids_in_order.append(sid)
                section_source[sid] = source_name
                continue

            # Compare to current merged version; if changed, apply.
            current_section = base_by_id[sid]
            if _stable_json(current_section) == _stable_json(edited_section):
                continue

            prev_src = section_source.get(sid, "--base--")
            if prev_src != "--base--" and prev_src != source_name:
                # conflict: another edited file already changed this section.
                conflicts.append(
                    Conflict(
                        section_id=sid,
                        section_title=_section_title_display(edited_section.get("title")),
                        first_source=prev_src,
                        second_source=source_name,
                    )
                )
                # Keep the first-applied version; do not overwrite.
                continue

            base_by_id[sid] = edited_section
            section_source[sid] = source_name

        add_updates(edited)

    # Rebuild merged.sections in the tracked order (dropping deleted ones)
    merged["sections"] = [base_by_id[sid] for sid in merged_section_ids_in_order if sid in base_by_id]

    # Merge updates and sort by timestamp if possible
    def sort_key(u: Dict[str, Any]) -> Tuple[int, str]:
        at = _safe_text(u.get("at"))
        dt = _parse_iso(at)
        if dt is None:
            return (1, at)
        return (0, dt.isoformat())

    merged["section_updates"] = sorted(merged_updates, key=sort_key)

    return merged, conflicts


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Merge multiple edited question bank JSON files into one.")
    ap.add_argument("--base", type=Path, default=None, help="Base/original bank JSON file")
    ap.add_argument("--out", type=Path, required=True, help="Output merged JSON file")
    ap.add_argument("--conflicts", type=Path, default=None, help="Optional conflicts report JSON path")
    ap.add_argument("edited", nargs="+", type=Path, help="Edited JSON files to merge")
    args = ap.parse_args(argv)

    edited_paths: List[Path] = args.edited

    if args.base is None:
        base_path = edited_paths[0]
        other_paths = edited_paths[1:]
    else:
        base_path = args.base
        other_paths = edited_paths

    base = load_json(base_path)
    validate_bank_shape(base)

    edited_banks: List[Tuple[str, Dict[str, Any]]] = []
    for p in other_paths:
        edited_banks.append((p.name, load_json(p)))

    merged, conflicts = merge_banks(base, edited_banks)
    dump_json(args.out, merged)

    if args.conflicts is None:
        conflicts_path = args.out.with_suffix(".conflicts_report.json")
    else:
        conflicts_path = args.conflicts

    if conflicts:
        report = {
            "conflicts": [
                {
                    "section_id": c.section_id,
                    "section_title": c.section_title,
                    "first_source": c.first_source,
                    "second_source": c.second_source,
                }
                for c in conflicts
            ]
        }
        dump_json(conflicts_path, report)
        print(f"Merged with {len(conflicts)} conflict(s). See: {conflicts_path}")
        return 2

    # No conflicts: still write an empty report if user asked explicitly.
    if args.conflicts is not None:
        dump_json(conflicts_path, {"conflicts": []})

    print(f"Merged OK: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

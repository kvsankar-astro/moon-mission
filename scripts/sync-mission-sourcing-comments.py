#!/usr/bin/env python3
"""
Sync docs/mission-sourcing/<mission>.md into comments inside assets/<mission>/data/config.json5.

This does NOT change runtime config values. It only updates JSON5 comment headers.
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs" / "mission-sourcing"
ASSETS_DIR = ROOT / "assets"

START_MARKER = "// --- sourcing-snapshot:start ---"
END_MARKER = "// --- sourcing-snapshot:end ---"
KV_LINE = re.compile(r"^\s*-\s*([^:]+):\s*(.+)\s*$")


def extract_sections(md_text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for raw_line in md_text.splitlines():
        line = raw_line.rstrip()
        if line.startswith("## "):
            current = line[3:].strip()
            sections[current] = []
            continue
        if current is None:
            continue
        sections[current].append(line)
    return sections


def extract_kv(lines: list[str]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for line in lines:
        match = KV_LINE.match(line)
        if match:
            out.append((match.group(1).strip(), match.group(2).strip()))
    return out


def extract_bullets(lines: list[str]) -> list[str]:
    out: list[str] = []
    for line in lines:
        text = line.strip()
        if text.startswith("- "):
            out.append(text[2:].strip())
    return out


def build_comment_block(mission: str, doc_rel: Path, sections: dict[str, list[str]]) -> str:
    lines: list[str] = []
    lines.append(START_MARKER)
    lines.append(f"// Source: {doc_rel.as_posix()}")

    identity = extract_kv(sections.get("Mission Identity", []))
    if identity:
        lines.append("// Mission Identity:")
        for key, value in identity:
            lines.append(f"//   {key}: {value}")

    time_window = extract_kv(sections.get("Time Window Used", []))
    if time_window:
        lines.append("// Time Window Used:")
        for key, value in time_window:
            lines.append(f"//   {key}: {value}")

    sources = extract_bullets(sections.get("Primary Source References", []))
    if sources:
        lines.append("// Primary Source References:")
        for item in sources:
            lines.append(f"//   - {item}")

    notes = extract_bullets(sections.get("Notes", []))
    if notes:
        lines.append("// Notes:")
        for item in notes:
            lines.append(f"//   - {item}")

    lines.append(END_MARKER)
    return "\n".join(lines) + "\n"


def upsert_block(json5_text: str, block: str) -> str:
    start_idx = json5_text.find(START_MARKER)
    end_idx = json5_text.find(END_MARKER)
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        end_line_idx = json5_text.find("\n", end_idx)
        if end_line_idx == -1:
            end_line_idx = len(json5_text)
        else:
            end_line_idx += 1
        return f"{json5_text[:start_idx]}{block}{json5_text[end_line_idx:]}"

    first_brace = json5_text.find("{")
    if first_brace == -1:
        return f"{json5_text.rstrip()}\n\n{block}"
    return f"{json5_text[:first_brace]}{block}{json5_text[first_brace:]}"


def main() -> int:
    docs = sorted(p for p in DOCS_DIR.glob("*.md") if p.stem != "horizons-worker-playbook")
    updated = 0
    skipped = 0
    for doc_path in docs:
        mission = doc_path.stem
        json5_path = ASSETS_DIR / mission / "data" / "config.json5"
        if not json5_path.exists():
            skipped += 1
            continue
        sections = extract_sections(doc_path.read_text(encoding="utf-8"))
        block = build_comment_block(mission, doc_path.relative_to(ROOT), sections)
        original = json5_path.read_text(encoding="utf-8")
        updated_text = upsert_block(original, block)
        if updated_text != original:
            json5_path.write_text(updated_text, encoding="utf-8")
            updated += 1

    print(f"Mission config.json5 files updated with sourcing comments: {updated}")
    print(f"Skipped (no matching config.json5): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

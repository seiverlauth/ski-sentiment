"""
Audit trails.json and write coverage_report.md.
Run after build_dataset.py --all-resorts.
"""

import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
TRAILS_FILE = DATA_DIR / "trails.json"
REPORT_FILE = DATA_DIR / "coverage_report.md"

DIFFICULTY_ORDER = ["green", "blue", "black", "double-black"]

TARGET_RESORTS = [
    "Vail", "Beaver Creek", "Breckenridge", "Keystone", "Aspen Snowmass",
    "Steamboat", "Crested Butte", "Telluride", "Winter Park", "Copper Mountain",
    "Park City", "Deer Valley", "Snowbird", "Alta", "Brighton", "Solitude",
    "Jackson Hole", "Big Sky", "Sun Valley",
    "Mammoth", "Palisades Tahoe", "Heavenly", "Northstar",
    "Killington", "Stowe",
]

MIN_TRAILS = 20
MIN_TIERS = 2


def main():
    with open(TRAILS_FILE) as f:
        trails = json.load(f)

    by_resort: dict[str, list] = defaultdict(list)
    for t in trails:
        by_resort[t["resort"]].append(t)

    lines = [
        "# Coverage Report",
        "",
        f"Total trails in dataset: **{len(trails)}**",
        f"Resorts in dataset: **{len(by_resort)}**",
        "",
        "## Per-Resort Coverage",
        "",
        "| Resort | State | Total | Green | Blue | Black | Dbl-Black | Tiers | Status |",
        "|--------|-------|------:|------:|-----:|------:|----------:|------:|--------|",
    ]

    flagged = []

    for resort_name in TARGET_RESORTS:
        resort_trails = by_resort.get(resort_name, [])
        by_diff = defaultdict(int)
        for t in resort_trails:
            by_diff[t["difficulty"]] += 1

        total = len(resort_trails)
        tiers = sum(1 for d in DIFFICULTY_ORDER if by_diff[d] > 0)
        g = by_diff["green"]
        b = by_diff["blue"]
        bk = by_diff["black"]
        db = by_diff["double-black"]

        if total < MIN_TRAILS or tiers < MIN_TIERS:
            status = "⚠ FLAGGED"
            flagged.append(resort_name)
        else:
            status = "✓ OK"

        state = next(
            (r["state"] for r in _TARGET_RESORT_STATES if r["resort"] == resort_name),
            "?",
        )
        lines.append(
            f"| {resort_name} | {state} | {total} | {g} | {b} | {bk} | {db} | {tiers} | {status} |"
        )

    lines += [
        "",
        "## Flagged Resorts (< 20 trails OR < 2 tiers represented)",
        "",
    ]

    if flagged:
        for r in flagged:
            lines.append(f"- **{r}** — insufficient coverage; excluded from analysis")
    else:
        lines.append("None — all 25 resorts meet the minimum threshold.")

    lines += [
        "",
        "## Global Distribution",
        "",
    ]

    global_by_diff = defaultdict(int)
    for t in trails:
        global_by_diff[t["difficulty"]] += 1

    for d in DIFFICULTY_ORDER:
        pct = global_by_diff[d] / len(trails) * 100 if trails else 0
        lines.append(f"- {d}: {global_by_diff[d]} trails ({pct:.1f}%)")

    report = "\n".join(lines) + "\n"
    REPORT_FILE.write_text(report)
    print(report)
    print(f"Written to {REPORT_FILE}")


_TARGET_RESORT_STATES = [
    {"resort": "Vail", "state": "CO"},
    {"resort": "Beaver Creek", "state": "CO"},
    {"resort": "Breckenridge", "state": "CO"},
    {"resort": "Keystone", "state": "CO"},
    {"resort": "Aspen Snowmass", "state": "CO"},
    {"resort": "Steamboat", "state": "CO"},
    {"resort": "Crested Butte", "state": "CO"},
    {"resort": "Telluride", "state": "CO"},
    {"resort": "Winter Park", "state": "CO"},
    {"resort": "Copper Mountain", "state": "CO"},
    {"resort": "Park City", "state": "UT"},
    {"resort": "Deer Valley", "state": "UT"},
    {"resort": "Snowbird", "state": "UT"},
    {"resort": "Alta", "state": "UT"},
    {"resort": "Brighton", "state": "UT"},
    {"resort": "Solitude", "state": "UT"},
    {"resort": "Jackson Hole", "state": "WY"},
    {"resort": "Big Sky", "state": "MT"},
    {"resort": "Sun Valley", "state": "ID"},
    {"resort": "Mammoth", "state": "CA"},
    {"resort": "Palisades Tahoe", "state": "CA"},
    {"resort": "Heavenly", "state": "CA"},
    {"resort": "Northstar", "state": "CA"},
    {"resort": "Killington", "state": "VT"},
    {"resort": "Stowe", "state": "VT"},
]


if __name__ == "__main__":
    main()

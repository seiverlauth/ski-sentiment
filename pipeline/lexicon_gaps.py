"""
Score all trails using the same lexicon logic as the React app prototype.
Identify the top 50 most common tokens that are NOT in the lexicon.
Write lexicon_gaps.md for human review.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
TRAILS_FILE = ROOT / "data" / "trails.json"
GAPS_FILE = ROOT / "data" / "lexicon_gaps.md"

# ── Lexicon (mirrored from app/ski-sentiment-app.jsx) ────────────────────────
LEXICON = {
    # DANGER / MORTALITY
    "widow": -4, "widowmaker": -4, "killer": -4, "death": -4, "dead": -3,
    "kill": -3, "suicide": -4, "grave": -3, "coffin": -4, "hell": -3,
    "devil": -3, "doom": -3, "terror": -3, "nightmare": -3, "hangman": -3,
    "gallows": -3, "executioner": -4, "massacre": -4, "slaughter": -4,
    "last": -1, "final": -1, "dying": -3,
    # PREDATORS / VENOMOUS
    "grizzly": -2, "wolverine": -2, "rattlesnake": -2, "viper": -2,
    "cobra": -2, "hornet": -2, "scorpion": -2, "shark": -2, "jaws": -2,
    "fang": -2, "claw": -2, "wolf": -2, "bear": -1, "panther": -2,
    "cougar": -2, "lynx": -1, "hawk": -1, "vulture": -2, "raven": -1,
    # HARSH TERRAIN
    "cliff": -3, "cliffs": -3, "headwall": -3, "couloir": -3, "chute": -2,
    "chutes": -2, "cornice": -2, "gully": -2, "spine": -2, "drop": -2,
    "ledge": -2, "crag": -2, "gnar": -2, "gnarly": -2, "mogul": -1,
    "moguls": -1, "bumps": -1, "rock": -1, "rocks": -1, "boulder": -1,
    "face": -1, "wall": -2, "abyss": -3, "void": -3, "precipice": -3,
    "bowl": -1, "woods": -1, "trees": -1, "saddle": -1, "line": -1,
    # HARSH ADJECTIVES
    "steep": -2, "narrow": -1, "tight": -1, "sharp": -1, "broken": -2,
    "twisted": -1, "crooked": -1, "plunge": -2, "fall": -1, "ice": -1,
    "icy": -1, "frozen": -1, "dark": -1, "shadow": -1, "shadowy": -2,
    "lost": -2, "lonely": -1, "ghost": -2, "haunted": -2, "wild": -1,
    "savage": -2, "brutal": -3, "vicious": -2, "ruthless": -2, "danger": -3,
    "hazard": -2, "warning": -2, "beware": -2, "never": -1, "screaming": -2,
    "screamer": -2, "mean": -1, "nasty": -2, "fearsome": -2, "dread": -3,
    "perilous": -3, "treacherous": -3, "thunder": -1,
    # BUNNY HILL DICTION
    "bunny": 3, "lullaby": 3, "easy": 3, "gentle": 3, "sweet": 3,
    "sunny": 3, "sunshine": 3, "sunnyside": 3, "smile": 3, "happy": 3,
    "joy": 3, "dream": 3, "pleasant": 3, "lovely": 3, "paradise": 3,
    "heaven": 3, "heavenly": 3, "friendly": 3, "cozy": 3,
    "kindergarten": 3, "family": 2,
    # PASTORAL / SCENIC
    "meadow": 2, "meadows": 2, "grove": 2, "pasture": 2, "garden": 2,
    "blossom": 2, "flower": 2, "daisy": 2, "rose": 2, "lily": 2,
    "butterfly": 2, "songbird": 2, "harmony": 2, "peaceful": 2, "calm": 2,
    "quiet": 2, "serene": 2, "tranquil": 2, "leisure": 2, "scenic": 2,
    "panorama": 2, "vista": 2, "alpine": 1, "aspen": 1, "fern": 1,
    "willow": 1, "birch": 1, "magic": 2, "magical": 2, "wonderland": 2,
    "creek": 1, "forest": 1,
    # MILD POSITIVE
    "glade": 1, "glades": 1, "powder": 1, "fluff": 1, "cloud": 1,
    "breeze": 1, "ridge": 1, "summit": 1, "soar": 1, "glide": 1,
    "cruise": 1, "cruiser": 1, "way": 0, "road": 0, "lane": 1, "path": 1,
    "view": 1, "sunset": 1, "sunrise": 1, "gold": 1, "golden": 1,
    "silver": 1, "crystal": 1, "jewel": 1, "gem": 1, "rainbow": 2,
    "star": 1, "christmas": 1, "holiday": 1,
    "loop": 1, "little": 1, "catwalk": 1,
}

NAMED_OVERRIDES = [
    "corbet", "rendezvous", "tuckerman", "kt-22", "kt 22",
    "the big one", "the nose", "s&s", "exhibition",
]

STOP_WORDS = {
    "the", "a", "an", "of", "at", "to", "in", "on", "and", "or", "is",
    "by", "for", "from", "with", "be", "as", "it", "its", "that", "this",
    # Single-letter tokens after splitting
    "s",
    # Generic ski trail words with no sentiment signal
    "run", "trail", "slope", "piste", "route", "area", "zone",
    # Common geographical connectors that are noise
    "upper", "lower", "middle", "north", "south", "east", "west",
    "no", "st", "mt", "dr",
}


def tokenize(name: str) -> list[str]:
    lower = name.lower()
    # Strip punctuation except apostrophes and hyphens inside words
    tokens = (
        lower.replace("/", " ")
        .replace("&", " ")
        .replace("'s", "")  # strip possessive
    )
    tokens = re.sub(r"[^\w\s'-]", " ", tokens)
    parts = tokens.split()
    result = []
    for t in parts:
        t = t.strip("-'")
        if t and len(t) > 1:
            result.append(t)
    return result


def main():
    with open(TRAILS_FILE) as f:
        trails = json.load(f)

    print(f"Scoring {len(trails)} trails...")

    # Token frequency: only count tokens not in lexicon and not stop words
    token_freq: Counter = Counter()
    token_examples: dict[str, list[str]] = defaultdict(list)

    lexicon_keys = set(LEXICON.keys())

    zero_score_count = 0
    nonzero_score_count = 0

    for t in trails:
        name = t["name"]
        lower = name.lower()

        # Check named overrides (these get scores, not gaps)
        has_override = any(ov in lower for ov in NAMED_OVERRIDES)
        if has_override:
            nonzero_score_count += 1
            continue

        tokens = tokenize(name)
        hit_any = False
        for tok in tokens:
            if tok in lexicon_keys:
                hit_any = True
            elif tok not in STOP_WORDS and len(tok) > 2:
                token_freq[tok] += 1
                if len(token_examples[tok]) < 3:
                    token_examples[tok].append(f"{name} ({t['resort']}, {t['difficulty']})")

        if hit_any:
            nonzero_score_count += 1
        else:
            zero_score_count += 1

    coverage_pct = nonzero_score_count / len(trails) * 100
    print(f"Trails scoring non-zero: {nonzero_score_count} ({coverage_pct:.1f}%)")
    print(f"Trails scoring zero (no lexicon hit): {zero_score_count} ({100 - coverage_pct:.1f}%)")

    top50 = token_freq.most_common(50)

    lines = [
        "# Lexicon Gaps",
        "",
        f"Analyzed {len(trails)} trails from 25 resorts.",
        f"Lexicon hit rate: **{coverage_pct:.1f}%** of trails have at least one scored token.",
        f"Zero-score trails: **{zero_score_count}** ({100 - coverage_pct:.1f}%) — names with no lexicon match.",
        "",
        "These are the 50 most-frequent tokens NOT in the current lexicon.",
        "Each is a candidate for addition — but the scores are judgment calls.",
        "A token appearing frequently in **black/double-black** names likely signals expert terrain;",
        "in **green/blue** names it may signal approachability.",
        "",
        "Review these and tell me which to add and with what score.",
        "",
        "| Rank | Token | Freq | Example trails |",
        "|-----:|-------|-----:|----------------|",
    ]

    for rank, (tok, freq) in enumerate(top50, 1):
        examples = " · ".join(token_examples[tok][:2])
        lines.append(f"| {rank} | `{tok}` | {freq} | {examples} |")

    lines += [
        "",
        "## Tokens by difficulty context",
        "",
        "For each candidate token, here's what difficulty tier it appears in most:",
        "",
    ]

    # For top 25, break down by difficulty
    diff_breakdown: dict[str, Counter] = defaultdict(Counter)
    for t in trails:
        for tok in tokenize(t["name"]):
            if tok in token_freq and tok not in STOP_WORDS:
                diff_breakdown[tok][t["difficulty"]] += 1

    lines.append("| Token | Green | Blue | Black | Dbl-Black | Likely signal |")
    lines.append("|-------|------:|-----:|------:|----------:|---------------|")
    for tok, _ in top50[:25]:
        c = diff_breakdown[tok]
        total = sum(c.values())
        if total == 0:
            continue
        db_pct = (c["double-black"] + c["black"]) / total
        g_pct = (c["green"] + c["blue"]) / total
        if db_pct > 0.6:
            signal = "expert terrain"
        elif g_pct > 0.6:
            signal = "approachable"
        else:
            signal = "mixed / neutral"
        lines.append(
            f"| `{tok}` | {c['green']} | {c['blue']} | {c['black']} | {c['double-black']} | {signal} |"
        )

    report = "\n".join(lines) + "\n"
    GAPS_FILE.write_text(report)
    print(f"\nWritten to {GAPS_FILE}")
    print("\nTop 20 gap tokens:")
    for tok, freq in top50[:20]:
        print(f"  {tok:20s}  {freq}")


if __name__ == "__main__":
    main()

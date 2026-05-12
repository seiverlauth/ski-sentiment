"""
Build data/trails.json from the cached OpenSkiMap runs GeoJSON.

Phase 1 (default): Process Jackson Hole only, print verification report, stop.
Phase 2 (--all-resorts): Process all 25 target resorts.

Schema discovery: properties.skiAreas is an array of GeoJSON Feature objects,
each with properties.name. We match ski area names against target resort fragments.
We restrict to difficultyConvention == "north_america" to avoid European difficulty
mappings which use the same OSM tags with different meanings.
"""

import argparse
import csv
import json
import math
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

# ------------------------------------------------------------------ paths
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
TRAILS_OUT = DATA_DIR / "trails.json"
SKIPPED_OUT = DATA_DIR / "skipped.csv"

# ------------------------------------------------------------------ OSM → 4-tier
DIFFICULTY_MAP = {
    "novice": "green",
    "easy": "green",
    "intermediate": "blue",
    "advanced": "black",
    "expert": "double-black",
    "freeride": "double-black",
    "extreme": "double-black",
}

# ------------------------------------------------------------------ target resorts
TARGET_RESORTS = [
    {
        "resort": "Vail",
        "resort_slug": "vail",
        "state": "CO",
        "match_fragments": ["vail"],
    },
    {
        "resort": "Beaver Creek",
        "resort_slug": "beaver-creek",
        "state": "CO",
        "match_fragments": ["beaver creek"],
    },
    {
        "resort": "Breckenridge",
        "resort_slug": "breckenridge",
        "state": "CO",
        "match_fragments": ["breckenridge"],
    },
    {
        "resort": "Keystone",
        "resort_slug": "keystone",
        "state": "CO",
        "match_fragments": ["keystone"],
    },
    {
        "resort": "Aspen Snowmass",
        "resort_slug": "aspen-snowmass",
        "state": "CO",
        "match_fragments": ["aspen mountain", "snowmass", "aspen highlands", "buttermilk"],
    },
    {
        "resort": "Steamboat",
        "resort_slug": "steamboat",
        "state": "CO",
        "match_fragments": ["steamboat"],
    },
    {
        "resort": "Crested Butte",
        "resort_slug": "crested-butte",
        "state": "CO",
        "match_fragments": ["crested butte mountain resort"],
    },
    {
        "resort": "Telluride",
        "resort_slug": "telluride",
        "state": "CO",
        "match_fragments": ["telluride"],
    },
    {
        "resort": "Winter Park",
        "resort_slug": "winter-park",
        "state": "CO",
        "match_fragments": ["winter park resort"],
    },
    {
        "resort": "Copper Mountain",
        "resort_slug": "copper-mountain",
        "state": "CO",
        "match_fragments": ["copper mountain"],
    },
    {
        "resort": "Park City",
        "resort_slug": "park-city",
        "state": "UT",
        "match_fragments": ["park city"],
    },
    {
        "resort": "Deer Valley",
        "resort_slug": "deer-valley",
        "state": "UT",
        "match_fragments": ["deer valley"],
    },
    {
        "resort": "Snowbird",
        "resort_slug": "snowbird",
        "state": "UT",
        "match_fragments": ["snowbird"],
    },
    {
        "resort": "Alta",
        "resort_slug": "alta",
        "state": "UT",
        "match_fragments": ["alta ski area"],
    },
    {
        "resort": "Brighton",
        "resort_slug": "brighton",
        "state": "UT",
        "match_fragments": ["brighton resort"],
    },
    {
        "resort": "Solitude",
        "resort_slug": "solitude",
        "state": "UT",
        "match_fragments": ["solitude"],
    },
    {
        "resort": "Jackson Hole",
        "resort_slug": "jackson-hole",
        "state": "WY",
        "match_fragments": ["jackson hole", "teton village"],
    },
    {
        "resort": "Big Sky",
        "resort_slug": "big-sky",
        "state": "MT",
        "match_fragments": ["big sky"],
    },
    {
        "resort": "Sun Valley",
        "resort_slug": "sun-valley",
        "state": "ID",
        "match_fragments": ["sun valley"],
    },
    {
        "resort": "Mammoth",
        "resort_slug": "mammoth",
        "state": "CA",
        "match_fragments": ["mammoth"],
    },
    {
        "resort": "Palisades Tahoe",
        "resort_slug": "palisades-tahoe",
        "state": "CA",
        "match_fragments": ["palisades tahoe", "squaw valley", "alpine meadows"],
    },
    {
        "resort": "Heavenly",
        "resort_slug": "heavenly",
        "state": "CA",
        "match_fragments": ["heavenly"],
    },
    {
        "resort": "Northstar",
        "resort_slug": "northstar",
        "state": "CA",
        "match_fragments": ["northstar"],
    },
    {
        "resort": "Killington",
        "resort_slug": "killington",
        "state": "VT",
        "match_fragments": ["killington"],
    },
    {
        "resort": "Stowe",
        "resort_slug": "stowe",
        "state": "VT",
        "match_fragments": ["stowe"],
    },
]

JACKSON_HOLE_CFG = next(r for r in TARGET_RESORTS if r["resort_slug"] == "jackson-hole")

# Regex: drop purely numeric names or "Run 4"-style artifacts
NUMERIC_TRAIL_RE = re.compile(
    r"^(run|trail|slope|piste|route)?\s*\d+\s*(run|trail|slope|piste|route)?$",
    re.IGNORECASE,
)


def _get_runs_file() -> Path:
    files = sorted(CACHE_DIR.glob("openskimap_runs_*.geojson"))
    if not files:
        sys.exit("No cached runs file found. Run `python fetch_openskimap.py` first.")
    return files[-1]


def _ski_area_names(properties: dict) -> list[str]:
    """Extract all ski area names from the skiAreas nested feature array."""
    areas = properties.get("skiAreas") or []
    names = []
    for area in areas:
        if isinstance(area, dict):
            area_props = area.get("properties") or {}
            name = area_props.get("name")
            if name:
                names.append(name)
    return names


def _matches_resort(area_names: list[str], fragments: list[str]) -> bool:
    for area_name in area_names:
        lower = area_name.lower()
        if any(frag in lower for frag in fragments):
            return True
    return False


def _centroid(coords_list) -> tuple[float | None, float | None]:
    """Compute mean lat/lon from a LineString or Polygon coordinate list."""
    try:
        flat = []
        # LineString: list of [lon, lat, ?elev]
        # Polygon: list of rings, each a list of [lon, lat, ?elev]
        if coords_list and isinstance(coords_list[0][0], list):
            for ring in coords_list:
                flat.extend(ring)
        else:
            flat = coords_list
        lons = [c[0] for c in flat]
        lats = [c[1] for c in flat]
        return round(sum(lats) / len(lats), 6), round(sum(lons) / len(lons), 6)
    except Exception:
        return None, None


def _length_m(coords_list) -> int | None:
    """Approximate length in meters using Haversine on LineString coords."""
    try:
        if coords_list and isinstance(coords_list[0][0], list):
            coords_list = coords_list[0]  # first ring of polygon
        total = 0.0
        R = 6371000
        for i in range(1, len(coords_list)):
            lon1, lat1 = math.radians(coords_list[i-1][0]), math.radians(coords_list[i-1][1])
            lon2, lat2 = math.radians(coords_list[i][0]), math.radians(coords_list[i][1])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
            total += R * 2 * math.asin(math.sqrt(a))
        return int(total)
    except Exception:
        return None


def _is_junk_name(name: str) -> bool:
    stripped = name.strip()
    if stripped.isdigit():
        return True
    if re.match(r"^[A-Z]\d+$", stripped):
        return True
    if NUMERIC_TRAIL_RE.match(stripped):
        return True
    return False


def load_and_index_features(runs_file: Path) -> dict[str, list]:
    """
    Stream-parse the GeoJSON and index features by ski area name fragment.
    Returns dict: lowercased area name → list of raw feature dicts.
    Only keeps features with:
      - difficultyConvention == "north_america"
      - at least one named skiArea
      - a mappable difficulty
    """
    print(f"Parsing {runs_file.name} ({runs_file.stat().st_size / 1e6:.0f} MB) ...")
    print("  (this takes ~60 seconds on first run)")

    with open(runs_file) as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"  Total features: {len(features):,}")

    # Build index: lowercased ski area name → features
    index: dict[str, list] = defaultdict(list)
    north_am = 0
    no_conv = 0

    for feat in features:
        props = feat.get("properties") or {}

        # Only North America convention (avoids European ski area difficulty mismatches)
        conv = props.get("difficultyConvention")
        if conv != "north_america":
            no_conv += 1
            continue
        north_am += 1

        area_names = _ski_area_names(props)
        if not area_names:
            continue

        for area_name in area_names:
            index[area_name.lower()].append(feat)

    print(f"  North America convention: {north_am:,}")
    print(f"  Other/missing convention: {no_conv:,}")
    print(f"  Unique ski areas indexed: {len(index):,}")
    return index


NORDIC_EXCLUSION_KEYWORDS = ["nordic", "cross-country", "cross country", "langlauf", "xc ski"]


def find_matching_areas(index: dict[str, list], fragments: list[str]) -> list:
    """Find all features whose ski area name matches any fragment, excluding nordic areas."""
    matched = []
    matched_areas = set()
    for area_name_lower, feats in index.items():
        if any(frag in area_name_lower for frag in fragments):
            if any(kw in area_name_lower for kw in NORDIC_EXCLUSION_KEYWORDS):
                print(f"    SKIP (nordic): '{area_name_lower}'")
                continue
            if area_name_lower not in matched_areas:
                matched_areas.add(area_name_lower)
                print(f"    MATCH: '{area_name_lower}' ({len(feats)} features)")
            matched.extend(feats)
    return matched


def process_resort(
    index: dict[str, list],
    resort_cfg: dict,
    skipped_rows: list,
) -> list[dict]:
    print(f"\n  Matching against fragments: {resort_cfg['match_fragments']}")
    raw_features = find_matching_areas(index, resort_cfg["match_fragments"])

    if not raw_features:
        print(f"  WARNING: No ski areas found for {resort_cfg['resort']}")
        return []

    print(f"  Raw features matched: {len(raw_features)}")

    trails = []
    seen: set[tuple] = set()

    for feat in raw_features:
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates")

        trail_name = props.get("name")

        # Drop missing name
        if not trail_name or not trail_name.strip():
            skipped_rows.append({
                "resort": resort_cfg["resort"],
                "name": "",
                "osm_difficulty": props.get("difficulty") or "missing",
                "reason": "missing_name",
            })
            continue

        trail_name = trail_name.strip()

        # Drop junk names
        if _is_junk_name(trail_name):
            skipped_rows.append({
                "resort": resort_cfg["resort"],
                "name": trail_name,
                "osm_difficulty": props.get("difficulty") or "missing",
                "reason": "numeric_or_artifact_name",
            })
            continue

        # Map difficulty
        osm_diff = props.get("difficulty") or ""
        osm_diff_lower = osm_diff.strip().lower()
        if osm_diff_lower not in DIFFICULTY_MAP:
            skipped_rows.append({
                "resort": resort_cfg["resort"],
                "name": trail_name,
                "osm_difficulty": osm_diff or "missing",
                "reason": f"unmappable_difficulty:{osm_diff or 'missing'}",
            })
            continue

        difficulty = DIFFICULTY_MAP[osm_diff_lower]

        # Dedup within resort
        dedup_key = (trail_name.lower(), difficulty)
        if dedup_key in seen:
            skipped_rows.append({
                "resort": resort_cfg["resort"],
                "name": trail_name,
                "osm_difficulty": osm_diff,
                "reason": "duplicate_within_resort",
            })
            continue
        seen.add(dedup_key)

        lat, lon = _centroid(coords) if coords else (None, None)
        length = _length_m(coords) if coords else None

        trails.append({
            "resort": resort_cfg["resort"],
            "resort_slug": resort_cfg["resort_slug"],
            "state": resort_cfg["state"],
            "name": trail_name,
            "difficulty": difficulty,
            "lat": lat,
            "lon": lon,
            "length_m": length,
            "source": "openskimap",
        })

    return trails


def jackson_hole_checkpoint(index: dict[str, list]) -> None:
    print("\n" + "=" * 60)
    print("CHECKPOINT: Jackson Hole only")
    print("=" * 60)

    skipped: list[dict] = []
    trails = process_resort(index, JACKSON_HOLE_CFG, skipped)

    by_diff: dict[str, list] = defaultdict(list)
    for t in trails:
        by_diff[t["difficulty"]].append(t)

    print(f"\nTotal trails kept: {len(trails)}")
    for diff in ["green", "blue", "black", "double-black"]:
        print(f"  {diff:>12}: {len(by_diff[diff])}")

    print("\n--- 10 random sample trails ---")
    sample = random.sample(trails, min(10, len(trails)))
    for t in sample:
        print(f"  [{t['difficulty']:>12}]  {t['name']}")

    print(f"\n--- First 5 dropped trails ---")
    for d in skipped[:5]:
        print(f"  name={d['name']!r:30s}  osm={d['osm_difficulty']!r:15s}  reason={d['reason']}")
    if len(skipped) > 5:
        print(f"  ... and {len(skipped) - 5} more")

    print("\n" + "=" * 60)
    print("Confirm mapping looks correct, then re-run with --all-resorts.")
    print("=" * 60)


def process_all_resorts(index: dict[str, list]) -> None:
    all_trails: list[dict] = []
    skipped_rows: list[dict] = []

    for resort_cfg in TARGET_RESORTS:
        print(f"\nProcessing: {resort_cfg['resort']} ({resort_cfg['state']})")
        trails = process_resort(index, resort_cfg, skipped_rows)
        print(f"  → {len(trails)} trails kept")
        all_trails.extend(trails)

    with open(TRAILS_OUT, "w") as f:
        json.dump(all_trails, f, indent=2)
    print(f"\nWrote {len(all_trails)} trails to {TRAILS_OUT}")

    if skipped_rows:
        with open(SKIPPED_OUT, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["resort", "name", "osm_difficulty", "reason"])
            writer.writeheader()
            writer.writerows(skipped_rows)
        print(f"Wrote {len(skipped_rows)} skipped rows to {SKIPPED_OUT}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all-resorts", action="store_true")
    args = parser.parse_args()

    runs_file = _get_runs_file()
    index = load_and_index_features(runs_file)

    if args.all_resorts:
        process_all_resorts(index)
    else:
        jackson_hole_checkpoint(index)


if __name__ == "__main__":
    main()

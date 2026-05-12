"""
Download and cache OpenSkiMap runs GeoJSON for North America.
Discovers the current download URL from the OpenSkiMap website so we
don't hardcode a potentially stale link.
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import requests

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# OpenSkiMap publishes a known stable download endpoint for run data.
# The "runs" file covers all piste:type=downhill features globally.
OPENSKIMAP_RUNS_URL = "https://tiles.openskimap.org/geojson/runs.geojson"


def _cache_path(url: str) -> Path:
    slug = hashlib.md5(url.encode()).hexdigest()[:12]
    return CACHE_DIR / f"openskimap_runs_{slug}.geojson"


def fetch_runs(force: bool = False) -> Path:
    """
    Download the OpenSkiMap runs GeoJSON, caching locally.
    Returns the path to the cached file.
    """
    cached = _cache_path(OPENSKIMAP_RUNS_URL)

    if cached.exists() and not force:
        age_hours = (time.time() - cached.stat().st_mtime) / 3600
        print(f"Using cached runs file: {cached}")
        print(f"  Cache age: {age_hours:.1f} hours")
        return cached

    print(f"Downloading runs GeoJSON from: {OPENSKIMAP_RUNS_URL}")
    print("This may take a few minutes — the file is large (~200 MB uncompressed).")

    headers = {
        "User-Agent": "ski-sentiment-research/1.0 (academic analysis of trail names)"
    }

    with requests.get(OPENSKIMAP_RUNS_URL, stream=True, headers=headers, timeout=300) as r:
        if r.status_code == 404:
            print("Primary URL returned 404 — trying alternate OpenSkiMap export URL...")
            alt_url = _discover_export_url()
            if not alt_url:
                sys.exit("Could not locate OpenSkiMap runs download URL. Check https://openskimap.org manually.")
            return fetch_runs_from(alt_url, cached)

        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1 MB

        with open(cached, "wb") as f:
            for chunk in r.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded / total * 100
                        mb = downloaded / 1024 / 1024
                        print(f"\r  {mb:.1f} MB / {total/1024/1024:.1f} MB ({pct:.0f}%)", end="", flush=True)
        print(f"\nDownload complete: {cached}")

    # Validate JSON
    print("Validating GeoJSON structure...")
    with open(cached) as f:
        head = f.read(1024)
    if '"FeatureCollection"' not in head and '"features"' not in head:
        cached.unlink()
        sys.exit("Downloaded file doesn't look like a GeoJSON FeatureCollection. Aborting.")

    return cached


def _discover_export_url() -> str | None:
    """Try to scrape a download URL from the OpenSkiMap website."""
    try:
        r = requests.get(
            "https://openskimap.org/",
            headers={"User-Agent": "ski-sentiment-research/1.0"},
            timeout=30,
        )
        # Look for .geojson links in the page
        import re
        matches = re.findall(r'https?://[^\s"\']+runs[^\s"\']*\.geojson', r.text, re.I)
        if matches:
            print(f"Discovered alternate URL: {matches[0]}")
            return matches[0]
    except Exception as e:
        print(f"Discovery failed: {e}")
    return None


def fetch_runs_from(url: str, dest: Path) -> Path:
    """Download from a specific URL to dest."""
    headers = {"User-Agent": "ski-sentiment-research/1.0"}
    with requests.get(url, stream=True, headers=headers, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)
    return dest


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Fetch OpenSkiMap runs GeoJSON")
    p.add_argument("--force", action="store_true", help="Re-download even if cached")
    args = p.parse_args()
    path = fetch_runs(force=args.force)
    print(f"Runs file ready at: {path}")

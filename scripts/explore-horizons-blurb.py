#!/usr/bin/env python3
"""
Exploratory script to understand JPL HORIZONS blurb format.

The 'blurb' is the OBJ_DATA section that HORIZONS returns with metadata
about a spacecraft or celestial body.

This script fetches blurbs for a few test spacecraft to understand:
1. The format of the blurb
2. What metadata is available
3. How to parse it for downstream use
"""

import requests
import json
import re
from datetime import datetime
from pathlib import Path

from horizons_text_cache import (
    get_default_cache_dir,
    read_cached_text,
    write_cached_text,
)

# Test spacecraft IDs
TEST_SPACECRAFT = {
    'LRO': -85,
    'Chandrayaan-3': -158,
    'Apollo 10 LM': -399101,
    'Artemis 1': -1023,
    'CAPSTONE': -1176,
}

PROJECT_ROOT = Path(__file__).resolve().parent.parent
HORIZONS_TEXT_CACHE_DIR = get_default_cache_dir(PROJECT_ROOT)


def fetch_blurb(spacecraft_id: int, name: str = None) -> dict:
    """
    Fetch the OBJ_DATA blurb from HORIZONS for a spacecraft.

    Args:
        spacecraft_id: JPL HORIZONS spacecraft ID (negative number)
        name: Human-readable name for logging

    Returns:
        dict with 'raw_text', 'parsed' fields
    """
    base_url = "https://ssd.jpl.nasa.gov/api/horizons.api"

    # Request object data without ephemeris
    params = {
        'format': 'text',
        'COMMAND': str(spacecraft_id),
        'OBJ_DATA': 'YES',      # This is the key - get the blurb!
        'MAKE_EPHEM': 'NO',     # Don't need ephemeris data
    }

    print(f"\n{'='*60}")
    print(f"Fetching blurb for: {name or spacecraft_id} (ID: {spacecraft_id})")
    print(f"{'='*60}")

    try:
        cached_text = read_cached_text(
            base_url=base_url,
            params=params,
            cache_dir=HORIZONS_TEXT_CACHE_DIR,
        )
        if cached_text is not None:
            content = cached_text
        else:
            response = requests.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            content = response.text
            write_cached_text(
                base_url=base_url,
                params=params,
                text=content,
                cache_dir=HORIZONS_TEXT_CACHE_DIR,
                extra_metadata={
                    'spacecraft_id': spacecraft_id,
                    'name': name or str(spacecraft_id),
                    'kind': 'explore_blurb',
                },
            )

        return {
            'spacecraft_id': spacecraft_id,
            'name': name,
            'raw_text': content,
            'length': len(content),
            'fetched_at': datetime.now().isoformat()
        }

    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return None


def analyze_blurb(blurb_data: dict) -> dict:
    """
    Analyze the blurb content to understand its structure.
    """
    if not blurb_data:
        return None

    raw = blurb_data['raw_text']

    # Find sections in the blurb
    sections = {}

    # Look for common patterns
    patterns = {
        'name_line': r'(?:Revised|Target body name):\s*(.+?)(?:\s*\{|\s*$)',
        'spk_id': r'SPK ID[#:]?\s*(-?\d+)',
        'center': r'Center\s*(?:body|geodetic|site):\s*(.+?)(?:\s*\(|\s*$)',
        'start_time': r'Start time\s*:\s*(.+?)(?:\s*$)',
        'stop_time': r'Stop time\s*:\s*(.+?)(?:\s*$)',
        'ref_frame': r'Reference frame\s*:\s*(.+?)(?:\s*$)',
        'target_radii': r'Target radii\s*:\s*(.+?)(?:km|\s*$)',
        'target_pole': r'Target pole/equ\s*:\s*(.+?)(?:\s*$)',
        'cospar_id': r'(?:COSPAR|Int\'l)\s*(?:ID|Desig)\.?\s*:\s*(\S+)',
        'launch_date': r'Launch [Dd]ate\s*:\s*(.+?)(?:\s*$)',
        'mass': r'(?:Spacecraft|Total)\s*[Mm]ass\s*[=:]?\s*(\d+\.?\d*)\s*(?:kg)?',
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, raw, re.MULTILINE | re.IGNORECASE)
        if match:
            sections[key] = match.group(1).strip()

    # Find the main descriptive text block
    # Usually between the header and the ephemeris section markers

    # Look for $$SOF or **** markers that delimit sections
    markers = ['$$SOF', '$$SOE', '****', 'Ephemeris', 'TRAJECTORIES']

    lines = raw.split('\n')

    return {
        'sections_found': sections,
        'total_lines': len(lines),
        'raw_preview': raw[:2000] if len(raw) > 2000 else raw,
    }


def main():
    """Fetch and analyze blurbs for test spacecraft."""

    results = {}

    for name, spacecraft_id in TEST_SPACECRAFT.items():
        blurb = fetch_blurb(spacecraft_id, name)

        if blurb:
            analysis = analyze_blurb(blurb)
            results[name] = {
                'blurb': blurb,
                'analysis': analysis
            }

            # Print raw response for first one to see full format
            print(f"\n--- RAW RESPONSE ({blurb['length']} chars) ---")
            print(blurb['raw_text'])
            print(f"--- END RAW RESPONSE ---\n")

            if analysis:
                print(f"\n--- PARSED SECTIONS ---")
                for key, value in analysis['sections_found'].items():
                    print(f"  {key}: {value}")
                print(f"--- END PARSED SECTIONS ---\n")

    # Save all results to JSON for further analysis
    output_file = 'horizons-blurb-exploration.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        # Can't serialize full raw text nicely, save summary
        summary = {}
        for name, data in results.items():
            summary[name] = {
                'spacecraft_id': data['blurb']['spacecraft_id'],
                'response_length': data['blurb']['length'],
                'sections_found': data['analysis']['sections_found'] if data['analysis'] else {},
                'fetched_at': data['blurb']['fetched_at']
            }
        json.dump(summary, f, indent=2)

    print(f"\nSummary saved to {output_file}")

    # Print summary table
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    print(f"{'Spacecraft':<20} {'ID':<10} {'Length':<10} {'Sections Found'}")
    print(f"{'-'*80}")
    for name, data in results.items():
        sections = list(data['analysis']['sections_found'].keys()) if data['analysis'] else []
        print(f"{name:<20} {data['blurb']['spacecraft_id']:<10} {data['blurb']['length']:<10} {', '.join(sections[:5])}")


if __name__ == '__main__':
    main()

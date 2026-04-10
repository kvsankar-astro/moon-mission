# Copyright (c) 2024-2025 Sankaranarayanan Viswanathan. All rights reserved.

# Assistance from Cursor AI was used to write this code based on the Perl version. 

import argparse
import os
import sys
import time
from datetime import datetime, timedelta
import calendar
import requests
import json
from datetime import timezone
import re
import numpy as np
import shutil
from pathlib import Path
from ephemeris_manifest import ensure_manifest_file
from horizons_text_cache import (
    cache_stem,
    find_covering_cached_text,
    get_default_cache_dir,
    read_cached_text,
    write_cached_text,
)

# constants - ephemerides related

# JPL NAIF IDs for celestial bodies (spacecraft IDs will be loaded from config)
JPL_MOON        = 301
JPL_EARTH       = 399
JPL_SUN         = 10

JPL_EARTH_CENTER = '@399'
JPL_MOON_CENTER = '@301'

# Planet codes dictionary - will be populated from config
planet_codes = {
    "MOON":     JPL_MOON,
    "EARTH":    JPL_EARTH,
    "SUN":      JPL_SUN
}

phase = None
mission = None  # Will be set from command line
date = datetime.now().strftime('%Y%m%d%H%M%S')
# Always use project root for data-fetched directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = None  # Will be set based on mission
debugging = True
primary_spacecraft_body_token = None
phase_spacecraft_body_token = None
HORIZONS_TEXT_CACHE_DIR = get_default_cache_dir(project_root)
HORIZONS_OUTPUT_LIMIT_RE = re.compile(
    r"Projected output length \(~(\d+)\) exceeds (\d+) line max -- change step-size"
)
MAX_VECTOR_SAMPLES_PER_REQUEST = 50000

def load_config(mission_name):
    """Load configuration from JSON file for specified mission."""
    global planet_codes
    
    # Use the config file for the specified mission
    config_file = os.path.join(os.path.dirname(__file__), '..', 'assets', mission_name, 'data', 'config.json')
    
    # Center mnemonic to JPL code mapping
    center_codes = {
        'earth_center': JPL_EARTH_CENTER,
        'moon_center': JPL_MOON_CENTER
    }
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            full_config = json.load(f)

        manifest_path = Path(project_root) / "assets" / mission_name / "data" / "ephemeris-manifest.json"
        ensure_manifest_file(
            manifest_path=manifest_path,
            mission_name=mission_name,
            config=full_config,
        )
        
        # Add spacecraft to planet_codes if it has an ID in config
        if 'spacecraft_id' in full_config:
            spacecraft_mnemonic = full_config.get('spacecraft_mnemonic', 'SC')
            spacecraft_id = full_config['spacecraft_id']
            
            # Add both the specific mnemonic and generic "SC"
            planet_codes[spacecraft_mnemonic] = spacecraft_id
            planet_codes['SC'] = spacecraft_id
            
            print_debug(f"Added spacecraft {spacecraft_mnemonic} and SC with ID {spacecraft_id}")
        
        # Get selectable origins from config.
        available_origins = [
            key for key in full_config.get('origins', [])
            if key != 'landing'
        ]
        print_debug(f"Available origins from config: {available_origins}")
        if not available_origins:
            print_error("No origins configured. Add a non-empty 'origins' list in config.json")
            sys.exit(1)
        
        # Process phase configurations
        phases_config = {}
        for phase_name in available_origins:
            if phase_name not in full_config:
                print_error(f"Origin '{phase_name}' listed in origins but not defined in config")
                sys.exit(1)

            phase_config = full_config[phase_name]

            # Skip disabled phases
            if not phase_config.get('enabled', True):
                print_debug(f"Skipping disabled phase: {phase_name}")
                continue

            # Convert center mnemonic to JPL code
            if 'center' not in phase_config:
                print_error(f"Phase '{phase_name}' missing 'center' configuration")
                sys.exit(1)

            center_mnemonic = phase_config['center']
            if center_mnemonic in center_codes:
                phase_config['center'] = center_codes[center_mnemonic]
            else:
                print_error(f"Unknown center mnemonic: {center_mnemonic}")
                sys.exit(1)

            phases_config[phase_name] = phase_config

        # Landing is a high-resolution slice, not an origin.
        landing_cfg = full_config.get('landing')
        if isinstance(landing_cfg, dict) and landing_cfg.get('enabled', True):
            if 'center' not in landing_cfg:
                print_error("Landing config missing 'center' configuration")
                sys.exit(1)
            landing_center_mnemonic = landing_cfg['center']
            if landing_center_mnemonic in center_codes:
                landing_center = center_codes[landing_center_mnemonic]
            else:
                print_error(f"Unknown landing center mnemonic: {landing_center_mnemonic}")
                sys.exit(1)

            landing_base = landing_cfg.copy()
            landing_base['center'] = landing_center

            landing_geo = landing_base.copy()
            landing_geo['center'] = JPL_EARTH_CENTER
            landing_geo['orbits_file'] = f"{landing_base['orbits_file']}-geo"
            phases_config['landing-geo'] = landing_geo

            landing_lunar = landing_base.copy()
            landing_lunar['orbits_file'] = f"{landing_base['orbits_file']}-lunar"
            phases_config['landing-lunar'] = landing_lunar

        # Append synthetic landing slices so they can be selected via CLI.
        augmented_phases = available_origins + [p for p in ['landing-geo', 'landing-lunar'] if p not in available_origins]

        return phases_config, augmented_phases
    except FileNotFoundError:
        print_error(f"Configuration file not found: {config_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print_error(f"Error parsing configuration file: {e}")
        sys.exit(1)

def copy_to_data_dir(source_path, filename, mission_name):
    """Copy a file from the timestamped directory to the mission's data directory."""
    try:
        dest_path = os.path.join(project_root, "assets", mission_name, "data", filename)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        shutil.copy2(source_path, dest_path)
        print_debug(f"Copied {source_path} to {dest_path}")
    except Exception as e:
        print_error(f"Error copying {source_path} to data directory: {e}")

# Initialize variables
start_year, start_month, start_day, start_hour, start_minute = None, None, None, None, None
stop_year, stop_month, stop_day, stop_hour, stop_minute = None, None, None, None, None
start_second, stop_second = 0, 0
step_size_in_seconds = None

planets = []
center = None
orbits_file = None

# global data structures

start_time_gm = 0  # set later in code
stop_time_gm = 0   # set later in code
start_time = ''    # set later in code 
stop_time = ''     # set later in code
step_size = ''     # set later in code

now = time.time()

def my_jd(t):
    return 2440587.5 + (t / 86400)

jd = my_jd(now)
orbits_raw = {}
orbits = {}

def filename_for_planet(fn):
    retfn = fn.replace('/', '_')
    print_debug(f"planet={fn}, filename={retfn}")
    return retfn

def parse_exact_phase_datetime(value):
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def init_config(option, config):
    global start_year, start_month, start_day, start_hour, start_minute
    global stop_year, stop_month, stop_day, stop_hour, stop_minute
    global start_second, stop_second
    global step_size_in_seconds, planets, center, orbits_file, phase_spacecraft_body_token

    start_dt = parse_exact_phase_datetime(config[option].get('sourceStartTime'))
    if start_dt is None:
        start_dt = parse_exact_phase_datetime(config[option].get('startTime'))
    stop_dt = parse_exact_phase_datetime(config[option].get('sourceEndTime'))
    if stop_dt is None:
        stop_dt = parse_exact_phase_datetime(config[option].get('endTime'))

    if start_dt is not None:
        start_year = f"{start_dt.year:04d}"
        start_month = f"{start_dt.month:02d}"
        start_day = f"{start_dt.day:02d}"
        start_hour = f"{start_dt.hour:02d}"
        start_minute = f"{start_dt.minute:02d}"
        start_second = int(start_dt.second)
    else:
        start_year = config[option]['start_year']
        start_month = config[option]['start_month']
        start_day = config[option]['start_day']
        start_hour = config[option]['start_hour']
        start_minute = config[option]['start_minute']
        start_second = 0

    if stop_dt is not None:
        stop_year = f"{stop_dt.year:04d}"
        stop_month = f"{stop_dt.month:02d}"
        stop_day = f"{stop_dt.day:02d}"
        stop_hour = f"{stop_dt.hour:02d}"
        stop_minute = f"{stop_dt.minute:02d}"
        stop_second = int(stop_dt.second)
    else:
        stop_year = config[option]['stop_year']
        stop_month = config[option]['stop_month']
        stop_day = config[option]['stop_day']
        stop_hour = config[option]['stop_hour']
        stop_minute = config[option]['stop_minute']
        stop_second = 0

    step_size_in_seconds = config[option]['step_size_in_seconds']

    planets = list(config[option]['planets'])

    # Always include Sun vectors in NPZ so runtime lighting can use NPZ-backed longitude.
    if "SUN" not in planets:
        planets.append("SUN")

    center = config[option]['center']

    orbits_file = config[option]['orbits_file']

def print_config():
    print(f"(start_year, start_month, start_day, start_hour, start_minute, start_second) = ({start_year}, {start_month}, {start_day}, {start_hour}, {start_minute}, {start_second})")
    print(f"(stop_year, stop_month, stop_day, stop_hour, stop_minute, stop_second) = ({stop_year}, {stop_month}, {stop_day}, {stop_hour}, {stop_minute}, {stop_second})")
    print(f"step_size_in_seconds = {step_size_in_seconds}")
    print(f"planets = {', '.join(planets)}")
    print(f"orbits_file = {orbits_file}")

def get_horizons_start_time(planet):
    # HORIZONS interprets START_TIME as TDB for vector tables (EPHEM_TYPE=VECTORS)
    # when no explicit time-system suffix is appended.  Config phase times carry
    # time_scale: "TDB" to document this convention.
    return f"'{start_year}-{start_month}-{start_day} {start_hour}:{start_minute}:{int(start_second):02d}'"

def get_horizons_stop_time(planet):
    # Same TDB convention as get_horizons_start_time.
    return f"'{stop_year}-{stop_month}-{stop_day} {stop_hour}:{stop_minute}:{int(stop_second):02d}'"
    

def set_start_and_stop_times():
    global start_time, start_time_gm, stop_time, stop_time_gm, step_size, jd

    start_time = f"{start_year}-{start_month}-{start_day}"
    start_time_gm = calendar.timegm((int(start_year), int(start_month), int(start_day), 
                                     int(start_hour), int(start_minute), int(start_second)))

    stop_time = f"{stop_year}-{stop_month}-{stop_day}"
    stop_time_gm = calendar.timegm((int(stop_year), int(stop_month), int(stop_day), 
                                    int(stop_hour), int(stop_minute), int(stop_second)))

    # If step size is >= 60 seconds and divisible by 60, use minutes
    # Otherwise, calculate number of steps to use 1-second default
    # HORIZONS API requires single quotes around values with spaces
    if step_size_in_seconds >= 60 and step_size_in_seconds % 60 == 0:
        step_size = f"'{step_size_in_seconds // 60} m'"  # Convert to minutes (quoted for HORIZONS)
    else:
        # Calculate total number of steps needed at 1-second intervals
        total_seconds = stop_time_gm - start_time_gm
        num_steps = total_seconds // step_size_in_seconds
        step_size = str(int(num_steps))  # Use number of steps (defaults to 1-second intervals)

    # Calculate JD for start time
    jd = my_jd(start_time_gm)

def print_debug(msg):
    if debugging:
        print(f"DEBUG: {msg}")

def print_error(msg):
    print(f"Error: {msg}", file=sys.stderr)

def my_jd(t):
    return 2440587.5 + (t / 86400)

def is_craft(planet):
    return (planet < 0) or ((planet == "MOON") and (phase == "geo"))

def save_fetched_data():
    """Save raw HORIZONS data to files for debugging/archival purposes."""
    try:
        for planet in planets:
            fn = filename_for_planet(planet)
            
            ho_file_name = f"{data_dir}/ho-{fn}-elements.txt"
            try:
                with open(ho_file_name, 'w') as fh:
                    horizons = orbits_raw.get(planet, {}).get('elements_content')
                    if horizons:
                        fh.write(horizons)
                    else:
                        fh.write(f"No elements content for {planet}\n")
            except IOError as e:
                print_error(f"Can't write to {ho_file_name}: {e}")
                return False

            ho_file_name = f"{data_dir}/ho-{fn}-vectors.txt"
            try:
                with open(ho_file_name, 'w') as fh:
                    horizons = orbits_raw[planet]['vectors_content']
                    fh.write(horizons)
            except IOError as e:
                print_error(f"Can't write to {ho_file_name}: {e}")
                return False

        return True
    except IOError as e:
        print_error(f"Failed to save fetched data: {e}")
        return False

def save_orbit_data_json():
    print_debug(f"Entering save_orbit_data_json")
    print_debug(f"orbits_file: {orbits_file}")
    
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(orbits_file), exist_ok=True)
        
        with open(f"{orbits_file}.json", 'w') as fh:
            json.dump(orbits, fh, indent=2)
        
        print_debug(f"JSON data written to {orbits_file}.json")

        # Note: Raw JSON is NOT copied to data dir - only Chebyshev files are used
        # The raw JSON stays in data-generated/ for debugging/archival

        # Verify the file was created and has content
        if os.path.exists(f"{orbits_file}.json") and os.path.getsize(f"{orbits_file}.json") > 0:
            print_debug(f"File {orbits_file}.json exists and has content")
        else:
            print_error(f"File {orbits_file}.json either doesn't exist or is empty")
        
        return True
    except IOError as e:
        print_error(f"IOError when writing to {orbits_file}.json: {e}")
    except json.JSONEncodeError as e:
        print_error(f"JSON encoding error: {e}")
    except Exception as e:
        print_error(f"Unexpected error when saving JSON: {e}")
    
    return False

def save_orbit_data():
    for planet in planets:
        fn = filename_for_planet(planet)
        ho_file_name = f"{data_dir}/ho-{fn}-orbit.txt"
        try:
            with open(ho_file_name, 'w') as fh:
                elements = orbits.get(planet, {}).get('elements')
                if not elements:
                    print_debug(f"Skipping orbit elements export for {planet}: no elements data")
                    continue
                
                # print_debug(f"Planet {planet} has elements at: {','.join(sorted(elements.keys()))}")
                
                for jdct in sorted(elements.keys()):
                    print_elements(fh, elements[jdct])
                    fh.write("\n")
                
                fh.write("\n")
        except IOError as e:
            print_error(f"Can't write to {ho_file_name}: {e}")


def build_horizons_params(planet, table_type, options):
    params = {
        'format': 'text',
        'COMMAND': str(planet_codes[planet]),
        'OBJ_DATA': 'NO',
        'MAKE_EPHEM': 'YES',
        'EPHEM_TYPE': table_type,
        'CENTER': center,
        'CSV_FORMAT': 'YES'
    }

    if options.get('range'):
        params.update({
            'START_TIME': options['start_time'],
            'STOP_TIME': options['stop_time'],
            'STEP_SIZE': options['step_size']
        })
    else:
        params['TLIST'] = str(jd)
    return params


def parse_horizons_request_datetime(value):
    if not isinstance(value, str):
        return None
    normalized = value.strip().strip("'").strip('"')
    if not normalized:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return None


def format_horizons_request_datetime(value):
    return f"'{value.strftime('%Y-%m-%d %H:%M')}'"


def parse_horizons_step_seconds(value):
    if not isinstance(value, str):
        return None
    normalized = value.strip().strip("'").strip('"').lower()
    minute_match = re.fullmatch(r"(\d+)\s*m", normalized)
    if minute_match:
        return int(minute_match.group(1)) * 60
    second_match = re.fullmatch(r"(\d+)\s*s", normalized)
    if second_match:
        return int(second_match.group(1))
    return None


def horizons_output_limit_hit(text):
    return bool(HORIZONS_OUTPUT_LIMIT_RE.search(text or ""))


def format_horizons_header_datetime(value):
    months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    month = months[value.month - 1]
    return f"A.D. {value.year:04d}-{month}-{value.day:02d} {value.hour:02d}:{value.minute:02d}:{value.second:02d}.0000 TDB"


def update_horizons_header_time(text, label, value):
    return re.sub(
        rf"^{re.escape(label)}:.*$",
        f"{label}: {format_horizons_header_datetime(value)}",
        text,
        count=1,
        flags=re.MULTILINE,
    )


def extract_horizons_block(text):
    lines = text.splitlines()
    start_index = None
    end_index = None
    for index, line in enumerate(lines):
        if line.startswith("$$SOE"):
            start_index = index
        elif line.startswith("$$EOE"):
            end_index = index
            break
    if start_index is None or end_index is None or end_index <= start_index:
        return None
    return {
        "prefix": lines[:start_index + 1],
        "rows": [line for line in lines[start_index + 1:end_index] if line.strip()],
        "suffix": lines[end_index:],
        "trailing_newline": text.endswith("\n"),
    }


def combine_horizons_vector_texts(texts, start_dt, stop_dt):
    if not texts:
        return None
    parsed_blocks = []
    for text in texts:
        block = extract_horizons_block(text)
        if block is None:
            return None
        parsed_blocks.append(block)

    combined_lines = []
    combined_lines.extend(parsed_blocks[0]["prefix"])
    for block in parsed_blocks:
        combined_lines.extend(block["rows"])
    combined_lines.extend(parsed_blocks[-1]["suffix"])

    combined_text = "\n".join(combined_lines)
    combined_text = update_horizons_header_time(combined_text, "Start time      ", start_dt)
    combined_text = update_horizons_header_time(combined_text, "Stop  time      ", stop_dt)
    if any(block["trailing_newline"] for block in parsed_blocks):
        combined_text += "\n"
    return combined_text


def download_horizons_text(base_url, params):
    max_retries = 3
    timeout_seconds = 300

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                wait_time = 5 * (2 ** (attempt - 1))
                print_debug(f"Retry attempt {attempt + 1}/{max_retries} after {wait_time}s...")
                time.sleep(wait_time)

            response = requests.get(base_url, params=params, timeout=timeout_seconds, stream=True)
            response.raise_for_status()

            content_bytes = b''
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                content_bytes += chunk

            content_text = content_bytes.decode('utf-8')
            print_debug(f"Downloaded {len(content_text)} characters")
            return content_text
        except requests.Timeout:
            print_error(f"Request timed out (attempt {attempt + 1}/{max_retries})")
            if attempt == max_retries - 1:
                return None
        except requests.RequestException as e:
            print_error(f"HTTP request failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt == max_retries - 1:
                return None

    return None


def should_preemptively_split(options, table_type):
    if table_type != 'VECTORS' or not options.get('range'):
        return False
    start_dt = parse_horizons_request_datetime(options.get('start_time'))
    stop_dt = parse_horizons_request_datetime(options.get('stop_time'))
    step_seconds = parse_horizons_step_seconds(options.get('step_size'))
    if start_dt is None or stop_dt is None or step_seconds is None or step_seconds <= 0:
        return False
    total_samples = int(((stop_dt - start_dt).total_seconds()) // step_seconds) + 1
    return total_samples > MAX_VECTOR_SAMPLES_PER_REQUEST


def fetch_split_horizons_vectors(planet, base_url, table_type, content_key, options):
    start_dt = parse_horizons_request_datetime(options.get('start_time'))
    stop_dt = parse_horizons_request_datetime(options.get('stop_time'))
    step_seconds = parse_horizons_step_seconds(options.get('step_size'))
    if start_dt is None or stop_dt is None or step_seconds is None or step_seconds <= 0:
        print_error(f"Unable to split HORIZONS request for {planet}: unsupported time or step format")
        return None

    total_samples = int(((stop_dt - start_dt).total_seconds()) // step_seconds) + 1
    if total_samples <= 2:
        print_error(f"Unable to split HORIZONS request for {planet}: range too small")
        return None

    if total_samples > MAX_VECTOR_SAMPLES_PER_REQUEST:
        first_chunk_samples = MAX_VECTOR_SAMPLES_PER_REQUEST
    else:
        first_chunk_samples = max(total_samples // 2, 2)
    first_end_dt = start_dt + timedelta(seconds=step_seconds * (first_chunk_samples - 1))
    second_start_dt = first_end_dt + timedelta(seconds=step_seconds)
    if second_start_dt > stop_dt:
        split_samples = max(total_samples // 2, 2)
        first_end_dt = start_dt + timedelta(seconds=step_seconds * (split_samples - 1))
        second_start_dt = first_end_dt + timedelta(seconds=step_seconds)
    if second_start_dt > stop_dt:
        print_error(f"Unable to split HORIZONS request for {planet}: no valid second chunk")
        return None

    print_debug(
        f"Splitting oversized HORIZONS vectors request for {planet}: "
        f"{start_dt.strftime('%Y-%m-%d %H:%M')} -> {first_end_dt.strftime('%Y-%m-%d %H:%M')}, "
        f"{second_start_dt.strftime('%Y-%m-%d %H:%M')} -> {stop_dt.strftime('%Y-%m-%d %H:%M')}"
    )

    chunk_texts = []
    for chunk_start, chunk_stop in (
        (start_dt, first_end_dt),
        (second_start_dt, stop_dt),
    ):
        chunk_options = dict(options)
        chunk_options['start_time'] = format_horizons_request_datetime(chunk_start)
        chunk_options['stop_time'] = format_horizons_request_datetime(chunk_stop)
        chunk_params = build_horizons_params(planet, table_type, chunk_options)
        chunk_text = fetch_horizons_text_payload(
            planet,
            base_url,
            table_type,
            content_key,
            chunk_options,
            chunk_params,
        )
        if chunk_text is None:
            return None
        chunk_texts.append(chunk_text)

    combined_text = combine_horizons_vector_texts(chunk_texts, start_dt, stop_dt)
    if combined_text is None:
        print_error(f"Failed to combine chunked HORIZONS vectors for {planet}")
        return None

    original_params = build_horizons_params(planet, table_type, options)
    write_cached_text(
        base_url=base_url,
        params=original_params,
        text=combined_text,
        cache_dir=HORIZONS_TEXT_CACHE_DIR,
        extra_metadata={
            "planet": str(planet),
            "table_type": table_type,
            "content_key": content_key,
            "mission": mission or "",
            "phase": phase or "",
            "cache_hit_type": "chunked-range",
        },
    )
    return combined_text


def fetch_horizons_text_payload(planet, base_url, table_type, content_key, options, params):
    cached_text = read_cached_text(
        base_url=base_url,
        params=params,
        cache_dir=HORIZONS_TEXT_CACHE_DIR,
    )
    if cached_text is not None and not horizons_output_limit_hit(cached_text):
        print_debug(
            f"Using cached HORIZONS {content_key} for {planet} "
            f"({len(cached_text)} characters)"
        )
        return cached_text

    if should_preemptively_split(options, table_type):
        return fetch_split_horizons_vectors(planet, base_url, table_type, content_key, options)

    if cached_text is None:
        covering_cache_hit = find_covering_cached_text(
            base_url=base_url,
            params=params,
            cache_dir=HORIZONS_TEXT_CACHE_DIR,
        )
        if covering_cache_hit is not None:
            covered_text, covering_metadata = covering_cache_hit
            print_debug(
                f"Using covering-range cached HORIZONS {content_key} for {planet} "
                f"({len(covered_text)} characters)"
            )
            write_cached_text(
                base_url=base_url,
                params=params,
                text=covered_text,
                cache_dir=HORIZONS_TEXT_CACHE_DIR,
                extra_metadata={
                    "planet": str(planet),
                    "table_type": table_type,
                    "content_key": content_key,
                    "mission": mission or "",
                    "phase": phase or "",
                    "cache_hit_type": "covering-range",
                    "derived_from_stem": covering_metadata.get("derived_from_stem", ""),
                    "derived_from_request": cache_stem(
                        base_url=base_url,
                        params=covering_metadata.get("params"),
                    ),
                },
            )
            return covered_text

        cached_text = download_horizons_text(base_url, params)
        if cached_text is None:
            return None
        write_cached_text(
            base_url=base_url,
            params=params,
            text=cached_text,
            cache_dir=HORIZONS_TEXT_CACHE_DIR,
            extra_metadata={
                "planet": str(planet),
                "table_type": table_type,
                "content_key": content_key,
                "mission": mission or "",
                "phase": phase or "",
            },
        )

    if '$$SOE' not in cached_text:
        if horizons_output_limit_hit(cached_text) and table_type == 'VECTORS' and options.get('range'):
            return fetch_split_horizons_vectors(planet, base_url, table_type, content_key, options)
        if 'No ephemeris' in cached_text or 'Cannot find' in cached_text:
            print_error(f"HORIZONS error: Object not found or no ephemeris available")
            print_debug(f"Response preview: {cached_text[:500]}")
            return None
        if table_type == 'VECTORS' and options.get('range'):
            start_dt = parse_horizons_request_datetime(options.get('start_time'))
            stop_dt = parse_horizons_request_datetime(options.get('stop_time'))
            if start_dt is not None and stop_dt is not None and (stop_dt - start_dt) > timedelta(days=2):
                print_debug(
                    f"Unexpected non-ephemeris HORIZONS response for {planet}; "
                    "retrying by splitting the range more finely"
                )
                return fetch_split_horizons_vectors(planet, base_url, table_type, content_key, options)
        print_error("Unexpected HORIZONS response without ephemeris data")
        print_debug(f"Response preview: {cached_text[:500]}")
        return None

    return cached_text

def fetch_horizons_data(planet, options):
    """Fetch data from JPL HORIZONS using the modern API endpoint.

    Uses https://ssd.jpl.nasa.gov/api/horizons.api (recommended since 2021)
    instead of the legacy horizons_batch.cgi endpoint.
    """
    table_type_map = {
        'elements': ('ELEMENTS', 'elements_content'),
        'vectors': ('VECTORS', 'vectors_content')
    }

    try:
        table_type, content_key = table_type_map[options['table_type']]
    except KeyError:
        raise ValueError(f"Invalid table_type: {options['table_type']}")

    # Modern API endpoint (recommended since September 2021)
    base_url = "https://ssd.jpl.nasa.gov/api/horizons.api"

    params = build_horizons_params(planet, table_type, options)

    print_debug(f"url = {base_url}")
    print_debug(f"params = {params}")

    content_text = fetch_horizons_text_payload(
        planet,
        base_url,
        table_type,
        content_key,
        options,
        params,
    )
    if content_text is None:
        return False

    orbits_raw.setdefault(planet, {})[content_key] = content_text
    return True

def fetch_elements(planet):
    print_debug(f"Fetching elements for planet {planet} ...")
    options = {
        'table_type': 'elements'
        # No 'range' option - uses TLIST with single JD time point
    }
    status = fetch_horizons_data(planet, options)
    print_debug(f"Fetching elements for planet {planet} completed.")
    return status

def fetch_vectors(planet):
    print_debug(f"Fetching vectors for planet {planet} ...")
    options = {
        'table_type': 'vectors',
        'range': True,
        'start_time': get_horizons_start_time(planet),
        'stop_time': get_horizons_stop_time(planet),
        'step_size': step_size
    }
    status = fetch_horizons_data(planet, options)
    print_debug(f"Fetching vectors for planet {planet} completed.")
    return status    

def parse_horizons_elements(code, planet):
    print_debug(f"Entering parse_horizons_elements: code = {code}, planet = {planet}")

    parse = False
    key = 'elements_content' if code == 'elements' else 'vectors_content'
    raw_content = orbits_raw[planet][key]
    print_debug(f"Raw {code} content length: {len(raw_content)} characters")
    if code == 'elements' and len(raw_content) < 1000:
        print_debug(f"Raw {code} content preview: {raw_content[:500]}...")
    lines = raw_content.split('\n')

    count = 0
    for line in lines:
        if line.startswith('$$SOE'):
            parse = True
            continue
        if line.startswith('$$EOE'):
            parse = False
            continue
        if parse:
            count += 1
            if code == 'elements':
                # Use regex to split the line, handling potential quoted fields
                fields = re.findall(r'(?:[^,"]|"(?:\\.|[^"])*")+', line)
                fields = [field.strip().strip('"') for field in fields]  # Remove leading/trailing spaces and quotes
                
                if len(fields) != 14:
                    print_error(f"Unexpected number of fields in line: {line}")
                    continue

                jdct, date, ec, qr, in_, om, w, tp, n, ma, ta, a, ad, pr = fields
                
                rec = {
                    'jdct': jdct, 'date': date, 'ec': ec, 'qr': qr, 'in': in_, 'om': om,
                    'w': w, 'tp': tp, 'n': n, 'ma': ma, 'ta': ta, 'a': a, 'ad': ad, 'pr': pr
                }

                if planet not in orbits:
                    orbits[planet] = {'elements': {}}
                if 'elements' not in orbits[planet]:
                    orbits[planet]['elements'] = {}
                if jdct in orbits[planet]['elements']:
                    # print_debug(f"Merging elements for planet={planet}, jdct={jdct}")
                    orbits[planet]['elements'][jdct].update(rec)
                else:
                    # print_debug(f"Adding elements for planet={planet}, jdct={jdct}")
                    orbits[planet]['elements'][jdct] = rec

            elif code == 'vectors':
                # Use regex to split the line, handling potential quoted fields
                fields = re.findall(r'(?:[^,"]|"(?:\\.|[^"])*")+', line)
                fields = [field.strip().strip('"') for field in fields]  # Remove leading/trailing spaces and quotes
                
                if len(fields) != 11:
                    print_error(f"Unexpected number of fields in line: {line}")
                    continue

                jdct, date, x, y, z, vx, vy, vz, lt, rg, rr = fields
                
                rec = {
                    'jdct': jdct,
                    'x': x, 'y': y, 'z': z,
                    'vx': vx, 'vy': vy, 'vz': vz
                }

                if planet not in orbits:
                    orbits[planet] = {'vectors': []}
                if 'vectors' not in orbits[planet]:
                    orbits[planet]['vectors'] = []
                
                orbits[planet]['vectors'].append(rec)

    print_debug(f"Found {count} {code} records for planet {planet}")
    print_debug("Leaving parse_horizons_elements")

    import sys

def print_elements(fh, rec):
    fh.write(f"JDCT = {rec['jdct']}\n")
    fh.write(f"Date = {rec['date']}\n")
    fh.write(f"EC = {rec['ec']}\n")
    fh.write(f"QR = {rec['qr']}\n")
    fh.write(f"IN = {rec['in']}\n")
    fh.write(f"OM = {rec['om']}\n")
    fh.write(f"W = {rec['w']}\n")
    fh.write(f"Tp = {rec['tp']}\n")
    fh.write(f"N = {rec['n']}\n")
    fh.write(f"MA = {rec['ma']}\n")
    fh.write(f"TA = {rec['ta']}\n")
    fh.write(f"A = {rec['a']}\n")
    fh.write(f"AD = {rec['ad']}\n")
    fh.write(f"PR = {rec['pr']}\n")
    # fh.write(f"X = {rec['x']}\n")
    # fh.write(f"Y = {rec['y']}\n")

def save_orbit_data_npy():
    print_debug(f"Entering save_orbit_data_npy")
    
    try:
        # Ensure the directory exists
        npy_dir = os.path.dirname(orbits_file)
        os.makedirs(npy_dir, exist_ok=True)
        
        npz_file = f"{orbits_file}.npz"
        npz_data = {}
        
        for planet, data in orbits.items():
            # Prepare elements data
            if 'elements' in data:
                elements_array = np.array([(float(e['jdct']), float(e['ec']), float(e['qr']), float(e['in']), 
                                            float(e['om']), float(e['w']), float(e['tp']), float(e['n']), 
                                            float(e['ma']), float(e['ta']), float(e['a']), float(e['ad']), 
                                            float(e['pr'])) 
                                           for e in data['elements'].values()],
                                          dtype=[('jdct', 'f8'), ('ec', 'f8'), ('qr', 'f8'), ('in', 'f8'),
                                                 ('om', 'f8'), ('w', 'f8'), ('tp', 'f8'), ('n', 'f8'),
                                                 ('ma', 'f8'), ('ta', 'f8'), ('a', 'f8'), ('ad', 'f8'),
                                                 ('pr', 'f8')])
                npz_data[f"{planet}_elements"] = elements_array
            
            # Prepare vectors data
            if 'vectors' in data:
                vectors_array = np.array([(float(v['jdct']), float(v['x']), float(v['y']), float(v['z']),
                                           float(v['vx']), float(v['vy']), float(v['vz']))
                                          for v in data['vectors']],
                                         dtype=[('jdct', 'f8'), ('x', 'f8'), ('y', 'f8'), ('z', 'f8'),
                                                ('vx', 'f8'), ('vy', 'f8'), ('vz', 'f8')])
                npz_data[f"{planet}_vectors"] = vectors_array
        
        # Save all data to a single .npz file
        np.savez_compressed(npz_file, **npz_data)

        print_debug(f"All NPY data written to {npz_file}")

        # Note: NPZ is NOT copied to data dir - only Chebyshev files are used
        # The NPZ stays in data-generated/ for compress-orbits.py to read
        
        # Generate metadata JSON file
        # Convert step size from seconds to minutes for metadata
        metadata = {
            "step_size_seconds": step_size_in_seconds,
            "step_size_minutes": step_size_in_seconds / 60.0,
            "start_time": f"{start_year}-{int(start_month):02d}-{int(start_day):02d} {int(start_hour):02d}:{int(start_minute):02d}",
            "end_time": f"{stop_year}-{int(stop_month):02d}-{int(stop_day):02d} {int(stop_hour):02d}:{int(stop_minute):02d}",
            "planets": planets,
            "phase": phase,
            "center": center,
            "generated_by": "orbits.py",
            "generated_at": datetime.now().isoformat(),
            "python_config": {
                "start_time": f"{start_year}-{int(start_month):02d}-{int(start_day):02d} {int(start_hour):02d}:{int(start_minute):02d}",
                "end_time": f"{stop_year}-{int(stop_month):02d}-{int(stop_day):02d} {int(stop_hour):02d}:{int(stop_minute):02d}"
            }
        }
        
        # Add data statistics
        for planet, data in orbits.items():
            if 'vectors' in data:
                metadata[f"{planet}_vectors_count"] = len(data['vectors'])
        
        # Write metadata JSON file
        meta_file = f"{orbits_file}-meta.json"
        with open(meta_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print_debug(f"Metadata written to {meta_file}")
        
        # Copy metadata file to project root
        meta_filename = os.path.basename(meta_file)
        copy_to_data_dir(meta_file, meta_filename, mission)
        
        return True
    except IOError as e:
        print_error(f"IOError when writing NPZ file: {e}")
    except ValueError as e:
        print_error(f"Value error when converting data: {e}")
    except Exception as e:
        print_error(f"Unexpected error when saving NPZ data: {e}")
    
    return False

def process_phase(current_phase, base_data_dir, config):
    """Process a single phase."""
    global phase, data_dir
    
    phase = current_phase
    data_dir = base_data_dir  # Use the base directory directly (no phase subdirectory)
    
    print(f"\n=== Processing {phase} phase ===")
    
    if not os.path.exists(data_dir):
        try:
            os.makedirs(data_dir)
        except OSError as e:
            print_error(f"Unable to create data directory {data_dir}: {e}")
            return False

    # Update orbits_file path in config for current data_dir
    config[phase]['orbits_file'] = f"{data_dir}/{os.path.basename(config[phase]['orbits_file'])}"
    init_config(phase, config)
    print_config()

    set_start_and_stop_times()

    print_debug(f"Using a JD of {jd} for start time: {start_year}-{start_month}-{start_day} {start_hour}:{start_minute}:{int(start_second):02d}")

    # Fetch data for all planets
    for planet in planets:
        if planet != "SUN":
            if not fetch_elements(planet):
                print_error(f"Failed to fetch elements for {planet}. Exiting.")
                return False
        if not fetch_vectors(planet):
            print_error(f"Failed to fetch vectors for {planet}. Exiting.")
            return False
        
    # Save raw fetched data for debugging/archival
    if not save_fetched_data():
        print_error("Failed to save fetched data. Exiting.")
        return False
    
    for planet in planets:
        if planet != "SUN":
            parse_horizons_elements('elements', planet)
        parse_horizons_elements('vectors', planet)

    save_orbit_data()
    save_orbit_data_json()

    if save_orbit_data_npy():
        print(f"{phase} NPY data saved successfully")
    else:
        print(f"Failed to save {phase} NPY data")
        return False
    
    return True

def main():
    global mission, data_dir

    print("Running ...")

    parser = argparse.ArgumentParser(description="Orbit data fetcher and processor")
    parser.add_argument("--mission", required=True,
                        help="Mission name (e.g., chandrayaan3)")
    parser.add_argument("--phase", "--phases", nargs="+", 
                        help="Phase(s) of the mission to process (default: all phases from config)")
    parser.add_argument("--data-dir", default=None, help="Base data directory (default: timestamped)")
    
    args = parser.parse_args()

    mission = args.mission
    
    # Load configuration for the specified mission
    config, available_phases = load_config(mission)
    
    # Use specified phases or default to all available phases
    if args.phase:
        phases_to_process = args.phase
        # Validate phases
        for phase in phases_to_process:
            if phase not in available_phases:
                print_error(f"Phase '{phase}' not available for mission '{mission}'")
                print(f"Available phases: {', '.join(available_phases)}")
                sys.exit(1)
    else:
        # Default: process all available phases
        phases_to_process = list(config.keys())  # Use enabled phases from config
    
    # Set up base data directory with mission-specific path
    if args.data_dir:
        base_data_dir = args.data_dir
    else:
        # Output to data-generated/<mission>/ (gitignored)
        # Only metadata files are copied to assets/<mission>/data/
        base_data_dir = os.path.join(project_root, "data-generated", mission)
    
    print(f"Mission: {mission}")
    print(f"Available phases: {', '.join(available_phases)}")
    print(f"Processing phases: {', '.join(phases_to_process)}")
    print(f"Base data directory: {base_data_dir}")
    
    # Process each phase
    success_count = 0
    for current_phase in phases_to_process:
        # Clear global state for each phase
        global orbits_raw, orbits
        orbits_raw = {}
        orbits = {}
        
        if process_phase(current_phase, base_data_dir, config):
            success_count += 1
        else:
            print_error(f"Failed to process {current_phase} phase")
    
    # Summary
    print(f"\n=== SUMMARY ===")
    print(f"Successfully processed {success_count}/{len(phases_to_process)} phases")
    
    if success_count == len(phases_to_process):
        print("All phases completed successfully!")
    else:
        print(f"Failed to process {len(phases_to_process) - success_count} phase(s)")
        sys.exit(1)

if __name__ == "__main__":
    main()

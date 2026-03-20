# Copyright (c) 2024-2025 Sankaranarayanan Viswanathan. All rights reserved.

# Assistance from Cursor AI was used to write this code based on the Perl version. 

import argparse
import os
import sys
import time
from datetime import datetime
import calendar
import requests
import json
from datetime import datetime, timezone
import re
import numpy as np
import shutil
from pathlib import Path
from ephemeris_manifest import ensure_manifest_file

# constants - ephemerides related

# JPL NAIF IDs for celestial bodies (spacecraft IDs will be loaded from config)
JPL_MOON        = 301
JPL_EARTH       = 399

JPL_EARTH_CENTER = '@399'
JPL_MOON_CENTER = '@301'

# Planet codes dictionary - will be populated from config
planet_codes = {
    "MOON":     JPL_MOON,
    "EARTH":    JPL_EARTH
}

phase = None
mission = None  # Will be set from command line
date = datetime.now().strftime('%Y%m%d%H%M%S')
# Always use project root for data-fetched directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = None  # Will be set based on mission
debugging = True

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
        
        # Get available phases from config
        available_phases = full_config.get('phases', [])
        print_debug(f"Available phases from config: {available_phases}")
        
        # Process phase configurations
        phases_config = {}
        for phase_name in available_phases:
            if phase_name not in full_config:
                print_error(f"Phase '{phase_name}' listed in phases but not defined in config")
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

            # Special handling: also produce an Earth-centered landing phase for geo origin.
            if phase_name == "landing":
                # Duplicate with Earth center and suffixes for filenames
                landing_geo = phase_config.copy()
                landing_geo['center'] = JPL_EARTH_CENTER
                landing_geo['orbits_file'] = f"{phase_config['orbits_file']}-geo"
                phases_config['landing-geo'] = landing_geo
                # Keep lunar-centered version labeled explicitly for clarity
                landing_lunar = phase_config.copy()
                landing_lunar['center'] = phase_config['center']
                landing_lunar['orbits_file'] = f"{phase_config['orbits_file']}-lunar"
                phases_config['landing-lunar'] = landing_lunar

        # Append synthetic phases to the list so they can be selected via CLI
        augmented_phases = available_phases + [p for p in ['landing-geo', 'landing-lunar'] if p not in available_phases]

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

def init_config(option, config):
    global start_year, start_month, start_day, start_hour, start_minute
    global stop_year, stop_month, stop_day, stop_hour, stop_minute
    global step_size_in_seconds, planets, center, orbits_file

    start_year = config[option]['start_year']
    start_month = config[option]['start_month']
    start_day = config[option]['start_day']
    start_hour = config[option]['start_hour']
    start_minute = config[option]['start_minute']

    stop_year = config[option]['stop_year']
    stop_month = config[option]['stop_month']
    stop_day = config[option]['stop_day']
    stop_hour = config[option]['stop_hour']
    stop_minute = config[option]['stop_minute']

    step_size_in_seconds = config[option]['step_size_in_seconds']

    planets = config[option]['planets']

    center = config[option]['center']

    orbits_file = config[option]['orbits_file']

def print_config():
    print(f"(start_year, start_month, start_day, start_hour, start_minute) = ({start_year}, {start_month}, {start_day}, {start_hour}, {start_minute})")
    print(f"(stop_year, stop_month, stop_day, stop_hour, stop_minute) = ({stop_year}, {stop_month}, {stop_day}, {stop_hour}, {stop_minute})")
    print(f"step_size_in_seconds = {step_size_in_seconds}")
    print(f"planets = {', '.join(planets)}")
    print(f"orbits_file = {orbits_file}")

def get_horizons_start_time(planet):
    # HORIZONS API requires single quotes around datetime values with spaces
    return f"'{start_year}-{start_month}-{start_day} {start_hour}:{start_minute}'"

def get_horizons_stop_time(planet):
    # HORIZONS API requires single quotes around datetime values with spaces
    return f"'{stop_year}-{stop_month}-{stop_day} {stop_hour}:{stop_minute}'"    
    

def set_start_and_stop_times():
    global start_time, start_time_gm, stop_time, stop_time_gm, step_size, jd

    start_time = f"{start_year}-{start_month}-{start_day}"
    start_time_gm = calendar.timegm((int(start_year), int(start_month), int(start_day), 
                                     int(start_hour), int(start_minute), 0))

    stop_time = f"{stop_year}-{stop_month}-{stop_day}"
    stop_time_gm = calendar.timegm((int(stop_year), int(stop_month), int(stop_day), 
                                    int(stop_hour), int(stop_minute), 0))

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
                    horizons = orbits_raw[planet]['elements_content']
                    fh.write(horizons)
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
                elements = orbits[planet]['elements']
                
                # print_debug(f"Planet {planet} has elements at: {','.join(sorted(elements.keys()))}")
                
                for jdct in sorted(elements.keys()):
                    print_elements(fh, elements[jdct])
                    fh.write("\n")
                
                fh.write("\n")
        except IOError as e:
            print_error(f"Can't write to {ho_file_name}: {e}")

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

    # Build parameters - note: modern API doesn't need quotes around values
    params = {
        'format': 'text',  # Get text output (same as batch interface)
        'COMMAND': str(planet_codes[planet]),
        'OBJ_DATA': 'NO',  # Skip object data header
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

    print_debug(f"url = {base_url}")
    print_debug(f"params = {params}")

    # Retry logic with exponential backoff
    max_retries = 3
    timeout_seconds = 300  # 5 minutes timeout for large data fetches

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                wait_time = 5 * (2 ** (attempt - 1))  # Exponential backoff: 5s, 10s, 20s
                print_debug(f"Retry attempt {attempt + 1}/{max_retries} after {wait_time}s...")
                time.sleep(wait_time)

            # Use streaming to handle large responses reliably
            response = requests.get(base_url, params=params, timeout=timeout_seconds, stream=True)
            response.raise_for_status()  # Raises an HTTPError for bad responses

            # Read response in chunks to avoid connection issues with large data
            content_bytes = b''
            for chunk in response.iter_content(chunk_size=1024*1024):  # 1MB chunks
                content_bytes += chunk

            content_text = content_bytes.decode('utf-8')
            print_debug(f"Downloaded {len(content_text)} characters")

            # Check for HORIZONS error messages in response
            if '$$SOE' not in content_text:
                if 'No ephemeris' in content_text or 'Cannot find' in content_text:
                    print_error(f"HORIZONS error: Object not found or no ephemeris available")
                    print_debug(f"Response preview: {content_text[:500]}")
                    return False

            orbits_raw.setdefault(planet, {})[content_key] = content_text
            return True
        except requests.Timeout:
            print_error(f"Request timed out (attempt {attempt + 1}/{max_retries})")
            if attempt == max_retries - 1:
                return False
        except requests.RequestException as e:
            print_error(f"HTTP request failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt == max_retries - 1:
                return False

    return False

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

import os

# Cache functionality removed - data is always fetched fresh

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

    print_debug(f"Using a JD of {jd} for start time: {start_year}-{start_month}-{start_day} {start_hour}:{start_minute}")

    # Fetch data for all planets
    for planet in planets:
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

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

# constants - ephemerides related

JPL_CY3         = -158 # Chandrayaan 3 Lander
JPL_MOON        = 301
JPL_EARTH       = 399

JPL_EARTH_CENTER = '@399'
JPL_MOON_CENTER = '@301'

planet_codes = {
    "CY3":      JPL_CY3,
    "MOON":     JPL_MOON,
    "EARTH":    JPL_EARTH
}

phase = None
use_cached_data = False
date = datetime.now().strftime('%Y%m%d%H%M%S')
# Always use project root for data-fetched directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(project_root, "data-fetched", date)
debugging = True

def load_config():
    """Load configuration from JSON file."""
    # Use the single config file in the assets directory
    config_file = os.path.join(os.path.dirname(__file__), '..', 'assets', 'chandrayaan3', 'data', 'config.json')
    
    # Center mnemonic to JPL code mapping
    center_codes = {
        'earth_center': JPL_EARTH_CENTER,
        'moon_center': JPL_MOON_CENTER
    }
    
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        # Convert center mnemonics to JPL codes
        for phase in config:
            center_mnemonic = config[phase]['center']
            if center_mnemonic in center_codes:
                config[phase]['center'] = center_codes[center_mnemonic]
            else:
                print_error(f"Unknown center mnemonic: {center_mnemonic}")
                sys.exit(1)
        
        return config
    except FileNotFoundError:
        print_error(f"Configuration file not found: {config_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print_error(f"Error parsing configuration file: {e}")
        sys.exit(1)

def copy_to_project_root(source_path, filename):
    """Copy a file from the timestamped directory to the project root."""
    try:
        dest_path = os.path.join(project_root, filename)
        shutil.copy2(source_path, dest_path)
        print_debug(f"Copied {source_path} to {dest_path}")
    except Exception as e:
        print_error(f"Error copying {source_path} to project root: {e}")

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
    return f"{start_year}-{start_month}-{start_day} {start_hour}:{start_minute}"

def get_horizons_stop_time(planet):
    return f"{stop_year}-{stop_month}-{stop_day} {stop_hour}:{stop_minute}"    
    

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
    if step_size_in_seconds >= 60 and step_size_in_seconds % 60 == 0:
        step_size = f"{step_size_in_seconds // 60} m"  # Convert to minutes
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
    try:
        cache_file_name = f"{data_dir}/momcache.txt"
        try:
            with open(cache_file_name, 'w') as fh:
                fh.write(f"jd={jd}\n")
        except IOError as e:
            print_error(f"Failed to write to {cache_file_name}: {e}")
            return False

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
        
        # Copy to project root
        json_filename = os.path.basename(f"{orbits_file}.json")
        copy_to_project_root(f"{orbits_file}.json", json_filename)
        
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
    table_type_map = {
        'elements': ('ELEMENTS', 'elements_content'),
        'vectors': ('VECTORS', 'vectors_content')
    }
    
    try:
        table_type, content_key = table_type_map[options['table_type']]
    except KeyError:
        raise ValueError(f"Invalid table_type: {options['table_type']}")

    base_url = "https://ssd.jpl.nasa.gov/horizons_batch.cgi"
    params = {
        'batch': '1',
        'COMMAND': f"'{planet_codes[planet]}'",
        'TABLE_TYPE': f"'{table_type}'",
        'CENTER': f"'{center}'",
        'CSV_FORMAT': "'YES'"
    }
    
    if options.get('range'):
        params.update({
            'START_TIME': f"'{options['start_time']}'",
            'STOP_TIME': f"'{options['stop_time']}'",
            'STEP_SIZE': f"'{options['step_size']}'"
        })
    else:
        params['TLIST'] = f"{jd}'"

    print_debug(f"url = {base_url}")
    print_debug(f"params = {params}")

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Raises an HTTPError for bad responses
        
        orbits_raw.setdefault(planet, {})[content_key] = response.text
        return True
    except requests.RequestException as e:
        print_error(f"HTTP request failed: {str(e)}")
        return False

def fetch_elements(planet):
    print_debug(f"Fetching elements for planet {planet} ...")
    status = fetch_horizons_data(planet, {'table_type': 'elements'})
    print_debug(f"Fetching elements for planet {planet} completed.")
    return status

def fetch_vectors(planet):
    print_debug(f"Fetching vectors for planet {planet} ...")
    status = fetch_horizons_data(planet, {'table_type': 'vectors'})
    print_debug(f"Fetching vectors for planet {planet} completed.")
    return status    

import os

def load_cached_data():
    ret_status = True

    print_debug("Entering load_cached_data")

    cache_file = f"{data_dir}/momcache.txt"
    try:
        with open(cache_file, 'r') as cache:
            for line in cache:
                line = line.strip()
                if line.startswith('jd'):
                    global jd
                    jd = float(line.split('=')[1].strip())
                    print_debug(f"jd = {jd}")

        for planet in planets:
            for key in ['elements', 'vectors']:
                pn = filename_for_planet(planet)
                fn = f"{data_dir}/ho-{pn}-{key}.txt"

                if os.path.isfile(fn) and os.access(fn, os.R_OK):
                    try:
                        with open(fn, 'r') as f:
                            content = f.read()
                            if planet not in orbits_raw:
                                orbits_raw[planet] = {}
                            orbits_raw[planet][f"{key}_content"] = content
                    except IOError as e:
                        print_error(f"Unable to open {fn}: {e}")
                        ret_status = False
                        break
                else:
                    print_debug(f"File {fn} not found or not readable")

    except IOError as e:
        print_error(f"Unable to open {cache_file}: {e}")
        ret_status = False

    print_debug("Leaving load_cached_data")
    return ret_status

def parse_horizons_elements(code, planet):
    print_debug(f"Entering parse_horizons_elements: code = {code}, planet = {planet}")

    parse = False
    key = 'elements_content' if code == 'elements' else 'vectors_content'
    lines = orbits_raw[planet][key].split('\n')

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
                    'vx': vy, 'vy': vx, 'vz': vz  # Note: vx and vy are swapped as in original
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
        
        # Copy NPZ file to project root
        npz_filename = os.path.basename(npz_file)
        copy_to_project_root(npz_file, npz_filename)
        
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
        copy_to_project_root(meta_file, meta_filename)
        
        return True
    except IOError as e:
        print_error(f"IOError when writing NPZ file: {e}")
    except ValueError as e:
        print_error(f"Value error when converting data: {e}")
    except Exception as e:
        print_error(f"Unexpected error when saving NPZ data: {e}")
    
    return False

def process_phase(current_phase, use_cached_data, base_data_dir, config):
    """Process a single phase."""
    global phase, data_dir
    
    phase = current_phase
    data_dir = os.path.join(base_data_dir, phase)
    
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

    if use_cached_data:
        load_cached_data()

    for planet in planets:
        if not use_cached_data:
            if not fetch_elements(planet):
                print_error(f"Failed to fetch elements for {planet}. Exiting.")
                return False
            
            if not fetch_horizons_data(planet, {
                'table_type': 'vectors',
                'range': 1,
                'start_time': get_horizons_start_time(planet),
                'stop_time': get_horizons_stop_time(planet),
                'step_size': step_size
            }):
                print_error(f"Failed to fetch vector data for {planet}. Exiting.")
                return False
        
    if not use_cached_data:
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
    global use_cached_data

    print("Running ...")

    parser = argparse.ArgumentParser(description="Orbit data fetcher and processor")
    parser.add_argument("--phase", "--phases", nargs="+", choices=['geo', 'lunar', 'landing'], 
                        default=['geo'], help="Phase(s) of the mission to process")
    parser.add_argument("--use-cache", action="store_true", help="Use cached data")
    parser.add_argument("--data-dir", default=None, help="Base data directory (default: timestamped)")
    
    args = parser.parse_args()

    phases_to_process = args.phase
    use_cached_data = args.use_cache
    
    # Set up base data directory
    if args.data_dir:
        base_data_dir = args.data_dir
    else:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        base_data_dir = os.path.join(project_root, "data-fetched", timestamp)
    
    print(f"Processing phases: {', '.join(phases_to_process)}")
    print(f"Base data directory: {base_data_dir}")
    
    # Load configuration
    config = load_config()
    
    # Process each phase
    success_count = 0
    for current_phase in phases_to_process:
        # Clear global state for each phase
        global orbits_raw, orbits
        orbits_raw = {}
        orbits = {}
        
        if process_phase(current_phase, use_cached_data, base_data_dir, config):
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


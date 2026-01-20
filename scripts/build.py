#!/usr/bin/env python3
"""
Build script for orbit visualization project
Creates a dist folder with only files needed for deployment
"""

import os
import shutil
import json
import stat
from datetime import datetime
import argparse

def print_info(message):
    print(f"[INFO] {message}")

def print_error(message):
    print(f"[ERROR] {message}")

def print_success(message):
    print(f"[SUCCESS] {message}")

def remove_readonly(func, path, _):
    """Error handler for Windows permission issues"""
    os.chmod(path, stat.S_IWRITE)
    func(path)

def safe_rmtree(path):
    """Safely remove directory tree, handling Windows permission issues"""
    if os.path.exists(path):
        try:
            shutil.rmtree(path, onerror=remove_readonly)
        except PermissionError as e:
            print_error(f"Permission denied when removing {path}. Process may be using this directory.")
            print_info("Please close any file explorer windows or web servers using the dist directory and try again.")
            raise e

def ensure_dir(path):
    """Create directory if it doesn't exist"""
    os.makedirs(path, exist_ok=True)

def copy_file(src, dst):
    """Copy a single file"""
    ensure_dir(os.path.dirname(dst))
    shutil.copy2(src, dst)
    print_info(f"Copied: {src} -> {dst}")

def discover_missions():
    """Auto-discover available missions from assets directory"""
    assets_dir = "assets"
    missions = []
    
    if os.path.exists(assets_dir):
        for item in os.listdir(assets_dir):
            mission_path = os.path.join(assets_dir, item)
            config_path = os.path.join(mission_path, "data", "config.json")
            html_path = f"{item}.html"
            
            # Check if it's a valid mission (has config.json and HTML file)
            if (os.path.isdir(mission_path) and 
                os.path.exists(config_path) and 
                os.path.exists(html_path) and
                item != "platform"):
                missions.append(item)
    
    return sorted(missions)

def load_mission_config(mission):
    """Load mission configuration"""
    config_path = f"assets/{mission}/data/config.json"
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print_error(f"Error reading config for {mission}: {e}")
        return {}

def build(dist_dir="dist", clean=True, missions=None):
    """Build the distribution folder"""
    
    # Get project root (parent of scripts directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Change to project root
    os.chdir(project_root)
    
    # Auto-discover missions if none specified
    if missions is None:
        missions = discover_missions()
        print_info(f"Auto-discovered missions: {', '.join(missions)}")
    elif isinstance(missions, str):
        missions = [missions]
    
    if not missions:
        print_error("No missions found or specified!")
        return
    
    print_info(f"Building missions: {', '.join(missions)}")
    
    # Full path to dist directory
    dist_path = os.path.join(project_root, dist_dir)
    
    # Create dist directory if it doesn't exist
    ensure_dir(dist_path)
    
    # Clean dist directory contents if requested
    if clean and os.path.exists(dist_path):
        print_info(f"Cleaning {dist_dir} directory contents...")
        for item in os.listdir(dist_path):
            item_path = os.path.join(dist_path, item)
            if os.path.isdir(item_path):
                safe_rmtree(item_path)
            else:
                os.remove(item_path)
    
    print_info(f"Building distribution in {dist_path}...")
    
    # Build files list dynamically for all missions
    files_to_copy = []
    
    # Common files (shared across all missions)
    common_files = [
        # Favicon if exists
        ("favicon.ico", "favicon.ico") if os.path.exists("favicon.ico") else None,
        
        # Platform files (shared CSS/JS)
        ("assets/platform/css/mission.css", "assets/platform/css/mission.css"),
        ("assets/platform/js/astro.js", "assets/platform/js/astro.js"),
        ("assets/platform/js/mission.js", "assets/platform/js/mission.js"),
        ("assets/platform/js/chebyshev.js", "assets/platform/js/chebyshev.js"),
        
        # Third-party libraries
        ("third-party/css/ui-darkness/jquery-ui-1.10.3.custom.min.css", "third-party/css/ui-darkness/jquery-ui-1.10.3.custom.min.css"),
        ("third-party/d3.v3.min.js", "third-party/d3.v3.min.js"),
        ("third-party/jquery-1.9.1.js", "third-party/jquery-1.9.1.js"),
        ("third-party/jquery-ui-1.10.3.custom.min.js", "third-party/jquery-ui-1.10.3.custom.min.js"),
        ("third-party/jquery.dialogextend.min.js", "third-party/jquery.dialogextend.min.js"),
        ("third-party/threex.atmospherematerial.js", "third-party/threex.atmospherematerial.js"),
        ("third-party/ephemeris-0.1.0.min.js", "third-party/ephemeris-0.1.0.min.js"),
        ("third-party/TrackballControls.js", "third-party/TrackballControls.js"),
        ("third-party/three.min.js", "third-party/three.min.js"),
        
        # Texture images (shared across missions)
        ("images/earth/2_no_clouds_8k.jpg", "images/earth/2_no_clouds_8k.jpg"),
        ("images/earth/earthspec1k.jpg", "images/earth/earthspec1k.jpg"),
        ("images/moon/Solarsystemscope_texture_8k_moon.jpg", "images/moon/Solarsystemscope_texture_8k_moon.jpg"),
        ("images/moon/ldem_16_gsfc.png", "images/moon/ldem_16_gsfc.png"),
        ("images/sky/starmap_4k.jpg", "images/sky/starmap_4k.jpg"),
        ("images/sky/constellation_figures.jpg", "images/sky/constellation_figures.jpg"),
    ]
    
    files_to_copy.extend([f for f in common_files if f is not None])
    
    # Add mission-specific files
    for mission in missions:
        print_info(f"Processing mission: {mission}")
        
        # Load mission config
        mission_config = load_mission_config(mission)
        phases = mission_config.get('phases', ['geo'])
        spacecraft_mnemonic = mission_config.get('spacecraft_mnemonic', 'SC')
        
        # Mission HTML file
        html_file = f"{mission}.html"
        if os.path.exists(html_file):
            files_to_copy.append((html_file, html_file))
        
        # Mission config file
        config_file = f"assets/{mission}/data/config.json"
        if os.path.exists(config_file):
            files_to_copy.append((config_file, config_file))
        
        # Mission-specific JS files (like GA)
        js_dir = f"assets/{mission}/js"
        if os.path.exists(js_dir):
            for js_file in os.listdir(js_dir):
                if js_file.endswith('.js'):
                    src_path = os.path.join(js_dir, js_file)
                    files_to_copy.append((src_path, src_path))
        
        # 3D models
        models_dir = f"assets/{mission}/models"
        if os.path.exists(models_dir):
            for model_file in os.listdir(models_dir):
                if model_file.endswith(('.glb', '.gltf')):
                    src_path = os.path.join(models_dir, model_file)
                    files_to_copy.append((src_path, src_path))
        
        # Screenshots/images
        images_dir = f"assets/{mission}/images"
        if os.path.exists(images_dir):
            for img_file in os.listdir(images_dir):
                if img_file.endswith(('.png', '.jpg', '.jpeg')):
                    src_path = os.path.join(images_dir, img_file)
                    files_to_copy.append((src_path, src_path))
        
        # Phase-specific orbit data files
        for phase in phases:
            phase_config = mission_config.get(phase, {})
            if phase_config.get('enabled', True):  # Skip disabled phases
                # NPZ and meta files for each phase
                base_filename = f"{phase}-{spacecraft_mnemonic}"
                data_files = [
                    f"assets/{mission}/data/{base_filename}.npz",
                    f"assets/{mission}/data/{base_filename}-meta.json"
                ]
                
                for data_file in data_files:
                    if os.path.exists(data_file):
                        files_to_copy.append((data_file, data_file))
                    else:
                        print_info(f"Data file not found (will be generated): {data_file}")
        
        print_info(f"Mission {mission}: Found files")
    
    # CSS UI theme images directory (referenced by CSS)
    css_images_dir = "third-party/css/ui-darkness/images"
    
    # Copy individual files
    copied_files = 0
    missing_files = 0
    
    for item in files_to_copy:
        if item is None:
            continue
        src, dst = item
        if os.path.exists(src):
            copy_file(src, os.path.join(dist_path, dst))
            copied_files += 1
        else:
            print_error(f"File not found: {src}")
            missing_files += 1
    
    # Copy CSS UI theme images directory
    if os.path.exists(css_images_dir):
        print_info(f"Copying CSS theme images: {css_images_dir}")
        dst_css_images = os.path.join(dist_path, css_images_dir)
        ensure_dir(dst_css_images)
        for file in os.listdir(css_images_dir):
            src_file = os.path.join(css_images_dir, file)
            dst_file = os.path.join(dst_css_images, file)
            if os.path.isfile(src_file):
                shutil.copy2(src_file, dst_file)
                copied_files += 1
    
    # Create build info file
    build_info = {
        "build_date": datetime.now().isoformat(),
        "build_type": "production",
        "version": "1.0.0",
        "missions": missions,
        "files_copied": copied_files,
        "files_missing": missing_files
    }
    
    with open(os.path.join(dist_path, "build-info.json"), "w") as f:
        json.dump(build_info, f, indent=2)
    
    # Count total files
    total_files = sum(len(files) for _, _, files in os.walk(dist_path))
    
    print_success(f"Build complete! {total_files} files total, {copied_files} copied, {missing_files} missing")
    
    if missing_files > 0:
        print_error(f"Warning: {missing_files} required files were missing!")
    
    # List directory structure
    print_info("\nDirectory structure:")
    for root, dirs, files in os.walk(dist_path):
        level = root.replace(dist_path, "").count(os.sep)
        indent = " " * 2 * level
        print(f"{indent}{os.path.basename(root)}/")
        subindent = " " * 2 * (level + 1)
        for file in sorted(files)[:10]:  # Show first 10 files, sorted
            print(f"{subindent}{file}")
        if len(files) > 10:
            print(f"{subindent}... and {len(files) - 10} more files")

def main():
    parser = argparse.ArgumentParser(description="Build multi-mission project for deployment")
    parser.add_argument("--dist", default="dist", help="Distribution directory (default: dist)")
    parser.add_argument("--no-clean", action="store_true", help="Don't clean dist directory before building")
    parser.add_argument("--mission", "--missions", nargs="+", 
                        help="Specific mission(s) to build (default: all discovered missions)")
    
    args = parser.parse_args()
    
    missions = args.mission if hasattr(args, 'mission') and args.mission else None
    build(dist_dir=args.dist, clean=not args.no_clean, missions=missions)

if __name__ == "__main__":
    main()
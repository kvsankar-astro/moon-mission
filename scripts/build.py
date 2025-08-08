#!/usr/bin/env python3
"""
Build script for Chandrayaan 3 project
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

def build(dist_dir="dist", clean=True):
    """Build the distribution folder"""
    
    # Get project root (parent of scripts directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Change to project root
    os.chdir(project_root)
    
    # Load config to check if landing is enabled
    landing_enabled = True  # Default to True for backward compatibility
    config_path = "assets/chandrayaan3/data/config.json"
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                landing_enabled = config.get('landing', {}).get('enabled', True)
                print_info(f"Landing enabled in config: {landing_enabled}")
        else:
            print_info("Config file not found, assuming landing enabled")
    except Exception as e:
        print_error(f"Error reading config: {e}, assuming landing enabled")
        landing_enabled = True
    
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
    
    # Define specific files that are actually referenced
    files_to_copy = [
        # Main HTML file
        ("chandrayaan3.html", "chandrayaan3.html"),
        
        # Favicon if exists
        ("favicon.ico", "favicon.ico") if os.path.exists("favicon.ico") else None,
        
        # CSS files (referenced in HTML)
        ("assets/platform/css/mission.css", "assets/platform/css/mission.css"),
        ("third-party/css/ui-darkness/jquery-ui-1.10.3.custom.min.css", "third-party/css/ui-darkness/jquery-ui-1.10.3.custom.min.css"),
        
        # JavaScript files (referenced in HTML)
        ("assets/platform/js/astro.js", "assets/platform/js/astro.js"),
        ("assets/platform/js/mission.js", "assets/platform/js/mission.js"),
        ("assets/platform/js/npyreader.js", "assets/platform/js/npyreader.js"),
        ("assets/chandrayaan3/js/ga.js", "assets/chandrayaan3/js/ga.js"),
        
        # Third-party libraries (referenced in HTML)
        ("third-party/d3.v3.min.js", "third-party/d3.v3.min.js"),
        ("third-party/jquery-1.9.1.js", "third-party/jquery-1.9.1.js"),
        ("third-party/jquery-ui-1.10.3.custom.min.js", "third-party/jquery-ui-1.10.3.custom.min.js"),
        ("third-party/jquery.dialogextend.min.js", "third-party/jquery.dialogextend.min.js"),
        ("third-party/threex.atmospherematerial.js", "third-party/threex.atmospherematerial.js"),
        ("third-party/ephemeris-0.1.0.min.js", "third-party/ephemeris-0.1.0.min.js"),
        ("third-party/TrackballControls.js", "third-party/TrackballControls.js"),
        ("third-party/three.min.js", "third-party/three.min.js"),
        
        # 3D Model (referenced in JS)
        ("assets/chandrayaan3/models/cy3-small.glb", "assets/chandrayaan3/models/cy3-small.glb"),
        
        # Data files - Only NPZ and meta JSON (as per requirements)
        ("assets/chandrayaan3/data/geo-CY3.npz", "assets/chandrayaan3/data/geo-CY3.npz"),
        ("assets/chandrayaan3/data/geo-CY3-meta.json", "assets/chandrayaan3/data/geo-CY3-meta.json"),
        ("assets/chandrayaan3/data/lunar-CY3.npz", "assets/chandrayaan3/data/lunar-CY3.npz"),
        ("assets/chandrayaan3/data/lunar-CY3-meta.json", "assets/chandrayaan3/data/lunar-CY3-meta.json"),
        ("assets/chandrayaan3/data/config.json", "assets/chandrayaan3/data/config.json"),

        # Images - Only those referenced in JS
        ("images/earth/2_no_clouds_8k.jpg", "images/earth/2_no_clouds_8k.jpg"),
        ("images/earth/earthspec1k.jpg", "images/earth/earthspec1k.jpg"),
        ("images/moon/Solarsystemscope_texture_8k_moon.jpg", "images/moon/Solarsystemscope_texture_8k_moon.jpg"),
        ("images/moon/ldem_16_gsfc.png", "images/moon/ldem_16_gsfc.png"),
        ("images/sky/starmap_4k.jpg", "images/sky/starmap_4k.jpg"),
        ("images/sky/constellation_figures.jpg", "images/sky/constellation_figures.jpg"),
        
        # Social media screenshot (referenced in HTML meta)
        ("assets/chandrayaan3/images/chandrayaan3-screenshot.png", "assets/chandrayaan3/images/chandrayaan3-screenshot.png"),
    ]
    
    # Add landing files if enabled in config
    if landing_enabled:
        landing_files = [
            ("assets/chandrayaan3/data/landing-CY3.npz", "assets/chandrayaan3/data/landing-CY3.npz"),
            ("assets/chandrayaan3/data/landing-CY3-meta.json", "assets/chandrayaan3/data/landing-CY3-meta.json"),
        ]
        files_to_copy.extend(landing_files)
        print_info("Including landing data files in build")
    else:
        print_info("Skipping landing data files (disabled in config)")
    
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
    parser = argparse.ArgumentParser(description="Build Chandrayaan 3 project for deployment")
    parser.add_argument("--dist", default="dist", help="Distribution directory (default: dist)")
    parser.add_argument("--no-clean", action="store_true", help="Don't clean dist directory before building")
    
    args = parser.parse_args()
    
    build(dist_dir=args.dist, clean=not args.no_clean)

if __name__ == "__main__":
    main()
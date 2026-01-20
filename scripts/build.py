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

def copy_tree(src_dir, dst_dir, ignore=None):
    """Copy a directory tree into dist, optionally ignoring some entries."""
    if not os.path.exists(src_dir):
        print_error(f"Directory not found: {src_dir}")
        return 0

    ensure_dir(os.path.dirname(dst_dir))
    shutil.copytree(src_dir, dst_dir, dirs_exist_ok=True, ignore=ignore)

    # Best-effort count for reporting
    return sum(len(files) for _, _, files in os.walk(dst_dir))

def discover_missions():
    """Auto-discover available missions from assets directory"""
    assets_dir = "assets"
    missions = []
    
    if os.path.exists(assets_dir):
        for item in os.listdir(assets_dir):
            mission_path = os.path.join(assets_dir, item)
            config_path = os.path.join(mission_path, "data", "config.json")
            
            # Check if it's a valid mission (has config.json)
            if (os.path.isdir(mission_path) and 
                os.path.exists(config_path) and
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
    
    copied_files = 0
    missing_files = 0

    # Entry points for the multi-mission app
    for html_file in ["mission.html", "index.html"]:
        if os.path.exists(html_file):
            copy_file(html_file, os.path.join(dist_path, html_file))
            copied_files += 1
        else:
            print_error(f"File not found: {html_file}")
            missing_files += 1

    # Optional favicon
    if os.path.exists("favicon.ico"):
        copy_file("favicon.ico", os.path.join(dist_path, "favicon.ico"))
        copied_files += 1

    # Shared runtime assets
    copied_files += copy_tree("assets/platform", os.path.join(dist_path, "assets", "platform"))
    copied_files += copy_tree("third-party", os.path.join(dist_path, "third-party"))
    copied_files += copy_tree("images", os.path.join(dist_path, "images"))

    # Mission assets (exclude raw archives by default)
    ignore_archives = shutil.ignore_patterns("archive")
    for mission in missions:
        print_info(f"Copying mission assets: {mission}")
        copied_files += copy_tree(
            os.path.join("assets", mission),
            os.path.join(dist_path, "assets", mission),
            ignore=ignore_archives,
        )
    
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

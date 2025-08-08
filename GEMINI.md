# Gemini Code Assistant Documentation

This document provides an overview of the Chandrayaan 3 orbit animation project for the Gemini code assistant.

## Project Overview

This project is a web-based 2D and 3D animation of the ISRO Chandrayaan 3 mission's orbit. It is an educational tool that visualizes the spacecraft's trajectory around the Earth and Moon.

## Technologies Used

-   **Frontend:** HTML, CSS, JavaScript
-   **3D Rendering:** THREE.js
-   **2D Rendering:** SVG, D3.js
-   **UI:** jQuery, jQuery UI
-   **Data:** JSON, NPZ (NumPy compressed format)

## Project Structure

-   `chandrayaan3.html`: The main HTML page for the animation.
-   `assets/chandrayaan3/js/cy3.js`: The core JavaScript file for the animation logic.
-   `assets/chandrayaan3/css/cy3.css`: The main stylesheet for the project.
-   `assets/chandrayaan3/data/`: Contains the orbit data in JSON and NPZ format.
-   `scripts/orbits.py`: Python script to fetch orbit data from NASA JPL HORIZONS.

## How to Run the Project

The project is a static website and can be run by opening the `chandrayaan3.html` file in a web browser. Due to browser security restrictions (CORS), it is recommended to use a local web server to host the files.

## Fetching Orbit Data

To fetch new or updated orbit data, run the `scripts/orbits.py` Python script. This script will download the latest data from NASA JPL HORIZONS and place it in the `assets/chandrayaan3/data/` directory.

**Usage:**

```bash
python scripts/orbits.py --phase=[geo|lunar|landing] --data-dir=<datadir> --use-cache
```

-   `--phase`: The phase of the mission to fetch data for (geocentric, selenocentric, or landing).
-   `--data-dir`: The directory to save the orbit data files.
-   `--use-cache`: Use cached orbit data if available.

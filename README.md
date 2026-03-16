
## Moon Mission Orbit Animations

A multi-mission platform for 3D and 2D orbital animations of lunar missions. Currently supports:

- **[Chandrayaan 3](http://sankara.net/mission.html?mission=cy3)** (2023) - India's successful Moon landing
- **[Chandrayaan 2](http://sankara.net/mission.html?mission=cy2)** (2019) - Vikram lander descent trajectory
- **[Apollo 10 LM](http://sankara.net/mission.html?mission=apollo10-lm)** (1969) - Snoopy lunar module
- **[Apollo 11 S-IVB](http://sankara.net/mission.html?mission=apollo11-sivb)** (1969) - Saturn V third stage
- **[Artemis 1](http://sankara.net/mission.html?mission=artemis1)** (2022) - Orion lunar mission

![Screenshot](/assets/chandrayaan3/images/chandrayaan3-screenshot.png?raw=true)

## Features

I created this animation for educational purposes. It has the following features:

* Real-world orbit data and predictions based on information available from JPL/NASA HORIZONS interface
* Rendering of the orbit in 2D and 3D
* Rendering of the orbit with either Earth or Moon at the center
* Rendering of the orbit with views locked on Earth, Moon, or the spacecraft
* Views aligned with J2000 reference axes
* Information on all earth bound and moon bound maneuvers (engine burns)
* Realistic textures for Earth and Moon in 3D mode
* Astronomically correct rendering of sunlight on Earth and Moon, poles, and polar axes
* Various animation controls for education - camera controls (pan, zoom, rotate), timeline controls, visibility controls
* A Joy Ride feature which lets you fly along with the spacecraft

## Run locally

Prerequisites: Node.js (for the Vite dev server). Python is only needed for orbit-data tooling.

```bash
npm install
npm run dev
```

Open:

`http://localhost:7274/mission.html?mission=cy3`

## Multi-Mission Support

URL parameters:

- `mission.html` - Mission selector page
- `mission.html?mission=cy3` - Chandrayaan 3
- `mission.html?mission=cy2` - Chandrayaan 2
- `mission.html?mission=apollo10-lm` - Apollo 10 LM (Snoopy)
- `mission.html?mission=apollo11-sivb` - Apollo 11 S-IVB
- `mission.html?mission=artemis1` - Artemis 1

### Debugging with NPZ ephemeris

To bypass Chebyshev and the Astronomy Engine for orbit data, set `"ephemeris_source": "npz"` in a mission's `config.json`, and place matching `.npz` files (e.g., `geo-<SC>.npz`, `lunar-<SC>.npz`, and when applicable `landing-<SC>-geo.npz` / `landing-<SC>-lunar.npz`) alongside the other data files. Earth, Moon, and spacecraft positions will then be read directly from the HORIZONS NPZ vectors.

Developer documentation (adding missions, orbit pipeline, build/deploy scripts): [docs/developer.md](docs/developer.md)

## Design

The animation has 2D and 3D rendering modes. 

The 2D mode uses SVG and D3 JS. Planetary orbits are rendered as ellipses
based on orbital elements. Spacecraft orbits are rendered using line segments
using position data.

The 3D mode uses THREE JS.

JQuery and JQueryUI are used for control and information panels.

Orbit data is fetched offline from JPL/NASA HORIZONS.
This data is processed and converted into Chebyshev polynomial format for efficient interpolation.
Moon and Earth positions are computed dynamically using Astronomy Engine.

**Time Systems:** The application uses TDB (Barycentric Dynamical Time) for all astronomical calculations
and Chebyshev lookups, matching the time system used by JPL HORIZONS. UTC is used for user-facing display.
See [docs/developer.md](docs/developer.md) for detailed technical documentation.

## Testing

The project includes automated UI testing (SSIM-based visual regression).

```bash
make test
```

See [docs/testing/](docs/testing/) for detailed test documentation.

### Hosting

At present the page can be hosted statically. There are no server components needed.
However, you need to serve it over HTTP (not `file://`) to avoid module/fetch/CORS issues.

For development, you can use the Vite dev server:
```bash
npm run dev
```

Or Python's built-in server:
```bash
python -m http.server 7274
```

Or Node.js http-server:
```bash
npx http-server
``` 

## Credits

* "Chandrayaan-2 in flight configuration" (https://skfb.ly/6SoMv) by tashtego is licensed under 
  Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  
* Jon D. Giorgini for helping with the JPL/HORIZONS interface and data. 
  He was very responsive whenever I mailed him my queries.
  He has been of great help since 2013 for the Mars Orbiter Mission until now
  for the Chandrayaan 3 mission.
  
* Members of the Bangalore Astronomy Society (http://bas.org.in/) for their valuable feedback

* Members of the Reddit r/isro (https://www.reddit.com/r/ISRO/) community for their valuable feedback
  
## Roadmap

This project is undergoing incremental modernization (the earliest versions date back to 2013).

See [docs/modernization-plan-2026.md](docs/modernization-plan-2026.md) for a detailed roadmap and current progress.

## AI assistance

See [docs/ai-tools.md](docs/ai-tools.md) for how AI tools are used in this repo (and where tool-specific notes live).

## Inspirations

* https://mgvez.github.io/jsorrery/ 
* https://github.com/Flowm/satvis
* https://github.com/CoryG89/MoonDemo 
* http://stuffin.space/ 
* https://theskylive.com/3dsolarsystem 



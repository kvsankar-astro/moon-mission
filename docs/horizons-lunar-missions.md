# Lunar Missions in JPL HORIZONS Database

This document catalogs lunar missions and their availability in the [JPL HORIZONS](https://ssd.jpl.nasa.gov/horizons/) ephemeris system.

**Last Updated:** January 2026

---

## Table of Contents

1. [Summary](#summary)
2. [Missions with Confirmed HORIZONS Data](#missions-with-confirmed-horizons-data)
3. [Missions by Country/Agency](#missions-by-countryagency)
4. [Historical Missions (Pre-2000)](#historical-missions-pre-2000)
5. [Modern Missions (2000-Present)](#modern-missions-2000-present)
6. [Missions Without Confirmed HORIZONS Data](#missions-without-confirmed-horizons-data)
7. [Notes and References](#notes-and-references)

---

## Summary

| Category | Count |
|----------|-------|
| Missions with verified HORIZONS data | 26 |
| Missions in NAIF/SPICE only (not HORIZONS) | 5 |
| Total lunar missions (all time) | 100+ |
| Countries with lunar missions | 7 |

**HORIZONS Coverage:** The JPL HORIZONS system includes trajectory data primarily for NASA missions and international missions that share data with JPL. Chinese (CNSA) and Russian (Roscosmos) spacecraft trajectories are generally limited to debris/booster tracking rather than primary spacecraft.

---

## Missions with Confirmed HORIZONS Data

### NASA Missions

| Mission | HORIZONS ID | COSPAR ID | Type | Years | Status |
|---------|-------------|-----------|------|-------|--------|
| **Apollo 8 S-IVB** | -399080 | 1968-118B | Third Stage | 1968 | Heliocentric |
| **Apollo 9 S-IVB** | -399090 | 1969-018B | Third Stage | 1969 | Heliocentric |
| **Apollo 10 S-IVB** | -399100 | 1969-043B | Third Stage | 1969 | Heliocentric |
| **Apollo 10 LM (Snoopy)** | -399101 | 1969-043C | Lunar Module | 1969 | Heliocentric |
| **Apollo 11 S-IVB** | -399110 | 1969-059B | Third Stage | 1969 | Lunar Impact |
| **Apollo 12 S-IVB** | -399120 | 1969-099B | Third Stage | 1969 | Heliocentric |
| **Clementine (DSPSE)** | -40 | 1994-004A | Orbiter | 1994 | Mission Complete |
| **Lunar Prospector** | -25 | 1998-001A | Orbiter | 1998-1999 | Lunar Impact |
| **LRO** | -85 | 2009-031A | Orbiter | 2009-present | Active |
| **LCROSS Shepherd** | -18 | 2009-031B | Impactor | 2009 | Lunar Impact |
| **LCROSS Centaur** | -18900 | 2009-031C | Impactor | 2009 | Lunar Impact |
| **GRAIL-A (Ebb)** | -177 | 2011-046A | Orbiter | 2011-2012 | Lunar Impact |
| **GRAIL-B (Flow)** | -181 | 2011-046B | Orbiter | 2011-2012 | Lunar Impact |
| **GRAIL-SS Stage** | -176 | 2011-046C | Second Stage | 2011 | - |
| **LADEE** | -12 | 2013-047A | Orbiter | 2013-2014 | Lunar Impact |
| **CAPSTONE** | -1176 | 2022-068A | NRHO Pathfinder | 2022-present | Active |
| **Lunar Flashlight** | -164 | 2022-156J | CubeSat | 2022-2023 | Mission Failed |
| **Lunar Trailblazer** | -242 | 2024-??? | Orbiter | 2024-present | Active |
| **Artemis 1 (Orion)** | -1023 | 2022-156A | Crewed Capsule | 2022 | Returned to Earth |

### International Missions (with HORIZONS data)

| Mission | HORIZONS ID | Agency | COSPAR ID | Type | Years | Status |
|---------|-------------|--------|-----------|------|-------|--------|
| **Chandrayaan-1** | -86 | ISRO | 2008-052A | Orbiter | 2008-2009 | Contact Lost |
| **Chandrayaan-2 Orbiter** | -152 | ISRO | 2019-042A | Orbiter | 2019-present | Active |
| **Chandrayaan-2 Lander (Vikram)** | -153 | ISRO | 2019-042B | Lander | 2019 | Crash |
| **Chandrayaan-3 Lander (Vikram)** | -158 | ISRO | 2023-098A | Lander | 2023 | Landed Successfully |
| **Chandrayaan-3 Propulsion** | -169 | ISRO | 2023-098B | Propulsion Module | 2023 | Lunar Orbit |
| **KPLO/Danuri** | -155 | KARI | 2022-094A | Orbiter | 2022-present | Active |
| **SLIM** | -240 | JAXA | 2023-137A | Lander | 2024 | Landed (Inverted) |

### Partial Data (Boosters/Debris Only)

| Object | HORIZONS ID | Mission | Notes |
|--------|-------------|---------|-------|
| Chang'e 5-T1 Booster | -78000 | Chang'e 5-T1 | 2014, Booster only |
| Chang'e 3 Booster | -139459 | Chang'e 3 | 2013, Booster only |
| Chang'e 4 Booster | -143846 | Chang'e 4 | 2018, Booster only |
| Luna-25 Stage | -9901492 | Luna 25 | 2023, Stage only |

### NAIF/SPICE Only (Not in HORIZONS API)

These missions have SPICE kernel data at NAIF but are **not available** through the HORIZONS web API:

| Mission | NAIF ID | Agency | Notes |
|---------|---------|--------|-------|
| **KAGUYA/SELENE** | -131 | JAXA | SPICE kernels at NAIF |
| **KAGUYA Relay Sat (Okina)** | -500 | JAXA | SPICE kernels at NAIF |
| **KAGUYA VLBI Sat (Ouna)** | -502 | JAXA | SPICE kernels at NAIF |
| **SMART-1** | -238 | ESA | SPICE kernels at NAIF |
| **Lunar IceCube** | -57 | NASA | CubeSat, lost contact |

> **Note:** These missions may have trajectory data in NAIF SPICE kernels but require different access methods than the HORIZONS API. See [NAIF Lunar Data](https://naif.jpl.nasa.gov/naif/data_lunar.html).

---

## Missions by Country/Agency

### United States (NASA)

**Apollo Program (1968-1972):**
- S-IVB stages tracked for Apollo 8, 9, 10, 11, 12
- Apollo 10 Lunar Module "Snoopy" (only surviving Apollo LM ascent stage)
- Command/Service Modules NOT in HORIZONS (returned to Earth)

**Robotic Missions:**
| Era | Mission | HORIZONS | Notes |
|-----|---------|----------|-------|
| 1994 | Clementine | Yes (-40) | First US return to Moon |
| 1998 | Lunar Prospector | Yes (-25) | Orbiter, polar mapper |
| 2009 | LRO | Yes (-85) | Still active |
| 2009 | LCROSS | Yes (-18, -18900) | Impact mission |
| 2011 | GRAIL | Yes (-177, -181) | Gravity mapping |
| 2013 | LADEE | Yes (-12) | Dust/atmosphere study |
| 2022 | CAPSTONE | Yes (-1176) | Gateway pathfinder |
| 2024 | Lunar Trailblazer | Yes (-242) | Water mapper |

### India (ISRO)

| Mission | Year | HORIZONS | ID | Status |
|---------|------|----------|-----|--------|
| Chandrayaan-1 | 2008 | Yes | -86 | Contact lost 2009 |
| Chandrayaan-2 Orbiter | 2019 | Yes | -152 | Active |
| Chandrayaan-2 Lander | 2019 | Yes | -153 | Crash |
| Chandrayaan-3 Lander | 2023 | Yes | -158 | Successful landing |
| Chandrayaan-3 Propulsion | 2023 | Yes | -169 | Lunar orbit |

### Japan (JAXA)

| Mission | Year | HORIZONS | ID | Status |
|---------|------|----------|-----|--------|
| Hiten/MUSES-A | 1990 | Unknown | - | First Japanese lunar mission |
| KAGUYA/SELENE | 2007 | Yes | -131 | Lunar impact 2009 |
| SLIM | 2024 | Yes | -240 | Landed (inverted) |

### European Space Agency (ESA)

| Mission | Year | HORIZONS | ID | Status |
|---------|------|----------|-----|--------|
| SMART-1 | 2003 | Yes | -238 | Lunar impact 2006 |

### South Korea (KARI)

| Mission | Year | HORIZONS | ID | Status |
|---------|------|----------|-----|--------|
| KPLO/Danuri | 2022 | Yes | -155 | Active |

### China (CNSA)

| Mission | Year | HORIZONS | Notes |
|---------|------|----------|-------|
| Chang'e 1 | 2007 | Booster only | Primary spacecraft: No |
| Chang'e 2 | 2010 | Booster only | Primary spacecraft: No |
| Chang'e 3 | 2013 | Booster only (-139459) | Primary spacecraft: No |
| Chang'e 4 | 2018 | Booster only (-143846) | Primary spacecraft: No |
| Chang'e 5 | 2020 | No confirmed | Sample return mission |
| Chang'e 5-T1 | 2014 | Booster only (-78000) | Test mission |
| Chang'e 6 | 2024 | No confirmed | Far side sample return |
| Queqiao 1 | 2018 | No confirmed | Relay satellite |
| Queqiao 2 | 2024 | No confirmed | Relay satellite |

### Russia/Soviet Union

| Mission | Year | HORIZONS | Notes |
|---------|------|----------|-------|
| Luna 1-24 | 1959-1976 | Unknown | Historic missions |
| Luna 25 | 2023 | Stage only (-9901492) | Primary spacecraft crashed |

### Israel

| Mission | Year | HORIZONS | Notes |
|---------|------|----------|-------|
| Beresheet | 2019 | Unknown | SpaceIL, crashed |

### Private/Commercial

| Mission | Year | HORIZONS | Notes |
|---------|------|----------|-------|
| Hakuto-R M1 | 2023 | Unknown | ispace, crashed |
| Peregrine | 2024 | Unknown | Astrobotic, failed |
| IM-1 Odysseus | 2024 | Unknown | Intuitive Machines, landed |
| IM-2 Athena | 2025 | Unknown | Intuitive Machines |

---

## Historical Missions (Pre-2000)

### Soviet Luna Program (1959-1976)

| Mission | Launch | Type | Outcome | HORIZONS |
|---------|--------|------|---------|----------|
| Luna 1 | 1959-01-02 | Flyby | First lunar flyby | Unknown |
| Luna 2 | 1959-09-12 | Impact | First lunar impact | Unknown |
| Luna 3 | 1959-10-04 | Flyby | First far side photos | Unknown |
| Luna 9 | 1966-01-31 | Lander | First soft landing | Unknown |
| Luna 10 | 1966-03-31 | Orbiter | First lunar orbiter | Unknown |
| Luna 16 | 1970-09-12 | Sample Return | First robotic sample return | Unknown |
| Luna 17 | 1970-11-10 | Rover | Lunokhod 1 | Unknown |
| Luna 21 | 1973-01-08 | Rover | Lunokhod 2 | Unknown |
| Luna 24 | 1976-08-09 | Sample Return | Last Soviet mission | Unknown |

### US Ranger Program (1961-1965)

| Mission | Launch | Outcome | HORIZONS |
|---------|--------|---------|----------|
| Ranger 7 | 1964-07-28 | Success - impact photos | Unknown |
| Ranger 8 | 1965-02-17 | Success - impact photos | Unknown |
| Ranger 9 | 1965-03-21 | Success - impact photos | Unknown |

### US Surveyor Program (1966-1968)

| Mission | Launch | Outcome | HORIZONS |
|---------|--------|---------|----------|
| Surveyor 1 | 1966-05-30 | First US soft landing | Unknown |
| Surveyor 3 | 1967-04-17 | Success, visited by Apollo 12 | Unknown |
| Surveyor 5 | 1967-09-08 | Success | Unknown |
| Surveyor 6 | 1967-11-07 | Success | Unknown |
| Surveyor 7 | 1968-01-07 | Success | Unknown |

### US Lunar Orbiter Program (1966-1967)

| Mission | Launch | Outcome | HORIZONS |
|---------|--------|---------|----------|
| Lunar Orbiter 1 | 1966-08-10 | Success - mapping | Unknown |
| Lunar Orbiter 2 | 1966-11-06 | Success - mapping | Unknown |
| Lunar Orbiter 3 | 1967-02-05 | Success - mapping | Unknown |
| Lunar Orbiter 4 | 1967-05-04 | Success - mapping | Unknown |
| Lunar Orbiter 5 | 1967-08-01 | Success - mapping | Unknown |

### Apollo Program - Crewed (1968-1972)

| Mission | Launch | Type | Notes | HORIZONS |
|---------|--------|------|-------|----------|
| Apollo 8 | 1968-12-21 | Lunar orbit | First crewed lunar orbit | S-IVB only (-399080) |
| Apollo 10 | 1969-05-18 | Lunar orbit | LM "Snoopy" test | S-IVB (-399100), LM (-399101) |
| Apollo 11 | 1969-07-16 | Landing | First Moon landing | S-IVB only (-399110) |
| Apollo 12 | 1969-11-14 | Landing | Visited Surveyor 3 | S-IVB only (-399120) |
| Apollo 13 | 1970-04-11 | Flyby | Aborted landing | Unknown |
| Apollo 14 | 1971-01-31 | Landing | Fra Mauro | Unknown |
| Apollo 15 | 1971-07-26 | Landing | First rover | Unknown |
| Apollo 16 | 1972-04-16 | Landing | Descartes | Unknown |
| Apollo 17 | 1972-12-07 | Landing | Last crewed mission | Unknown |

---

## Modern Missions (2000-Present)

### 2000-2010

| Year | Mission | Agency | Type | HORIZONS |
|------|---------|--------|------|----------|
| 2003 | SMART-1 | ESA | Orbiter | Yes (-238) |
| 2007 | KAGUYA/SELENE | JAXA | Orbiter | Yes (-131) |
| 2007 | Chang'e 1 | CNSA | Orbiter | Booster only |
| 2008 | Chandrayaan-1 | ISRO | Orbiter | Yes (-86) |
| 2009 | LRO | NASA | Orbiter | Yes (-85) |
| 2009 | LCROSS | NASA | Impactor | Yes (-18) |

### 2010-2020

| Year | Mission | Agency | Type | HORIZONS |
|------|---------|--------|------|----------|
| 2010 | Chang'e 2 | CNSA | Orbiter | Booster only |
| 2011 | GRAIL | NASA | Gravity mappers | Yes (-177, -181) |
| 2013 | LADEE | NASA | Atmosphere study | Yes (-12) |
| 2013 | Chang'e 3 | CNSA | Lander/Rover | Booster only |
| 2014 | Chang'e 5-T1 | CNSA | Test flight | Booster only |
| 2018 | Chang'e 4 | CNSA | Far side lander | Booster only |
| 2018 | Queqiao 1 | CNSA | Relay satellite | Unknown |
| 2019 | Beresheet | SpaceIL | Lander | Unknown |
| 2019 | Chandrayaan-2 | ISRO | Orbiter/Lander | Yes (-152, -153) |

### 2020-2025

| Year | Mission | Agency | Type | HORIZONS |
|------|---------|--------|------|----------|
| 2020 | Chang'e 5 | CNSA | Sample return | Unknown |
| 2022 | CAPSTONE | NASA | NRHO pathfinder | Yes (-1176) |
| 2022 | KPLO/Danuri | KARI | Orbiter | Yes (-155) |
| 2022 | Artemis 1 (Orion) | NASA | Crewed capsule | Yes (-1023) |
| 2022 | Lunar IceCube | NASA | CubeSat | Yes (-57) |
| 2022 | Lunar Flashlight | NASA | CubeSat | Yes (-164) |
| 2023 | Hakuto-R M1 | ispace | Lander | Unknown |
| 2023 | Luna 25 | Roscosmos | Lander | Stage only |
| 2023 | Chandrayaan-3 | ISRO | Lander | Yes (-158, -169) |
| 2024 | Peregrine | Astrobotic | Lander | Unknown |
| 2024 | SLIM | JAXA | Lander | Yes (-240) |
| 2024 | IM-1 Odysseus | Intuitive Machines | Lander | Unknown |
| 2024 | Chang'e 6 | CNSA | Sample return | Unknown |
| 2024 | Queqiao 2 | CNSA | Relay satellite | Unknown |
| 2024 | Lunar Trailblazer | NASA | Water mapper | Yes (-242) |
| 2025 | IM-2 Athena | Intuitive Machines | Lander | Unknown |

---

## Missions Without Confirmed HORIZONS Data

These missions either:
1. Don't have data in HORIZONS
2. Status unknown (needs verification)
3. Only booster/debris tracked

### Soviet/Russian

- All Luna program spacecraft (1959-1976)
- Zond flybys
- Luna 25 primary spacecraft (2023)

### Chinese (CNSA)

- Chang'e 1, 2, 3, 4, 5, 6 primary spacecraft
- Queqiao relay satellites
- Yutu/Yutu-2 rovers

### Commercial/Private

- Beresheet (SpaceIL)
- Hakuto-R Mission 1 (ispace)
- Peregrine (Astrobotic)
- IM-1 Odysseus, IM-2 Athena (Intuitive Machines)

### Historical NASA

- Ranger 1-9 (1961-1965)
- Surveyor 1-7 (1966-1968)
- Lunar Orbiter 1-5 (1966-1967)
- Apollo CSM/LM (except Apollo 10 LM)

---

## Notes and References

### About JPL HORIZONS

The [JPL HORIZONS](https://ssd.jpl.nasa.gov/horizons/) system provides ephemerides for:
- 1,479,000+ asteroids
- 4,043 comets
- 424 natural satellites
- All planets
- **239 spacecraft** (as of 2025)
- Lagrange points (L1, L2, L4, L5)

Spacecraft trajectory data sources include:
- JPL navigation teams
- Other NASA centers
- ESA
- TLE-based orbits (US Space Command)

### Spacecraft ID Convention

- Spacecraft use negative IDs (e.g., -85 for LRO)
- Some IDs are reused for inactive spacecraft (e.g., -12 was Pioneer 12, now LADEE)
- Apollo S-IVB stages use -399XXX format
- Boosters/debris may have different IDs than primary spacecraft

### How to Query HORIZONS

**Web Interface:** https://ssd.jpl.nasa.gov/horizons/app.html

**API Example:**
```
https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='-85'
```

**Lookup API (find spacecraft ID):**
```
https://ssd.jpl.nasa.gov/api/horizons_lookup.api?sstr=LRO&group=sct
```

### NAIF/SPICE Data

For missions with SPICE kernels, see:
- [NAIF Lunar Data](https://naif.jpl.nasa.gov/naif/data_lunar.html)
- [NAIF ID Codes](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/naif_ids.html)

Missions with SPICE kernels:
- Apollo
- Clementine
- GRAIL
- LADEE
- Lunar Prospector
- LRO
- Lunar Orbiters 1-5
- KAGUYA/SELENE
- SMART-1

### References

- [JPL HORIZONS System](https://ssd.jpl.nasa.gov/horizons/)
- [NAIF SPICE](https://naif.jpl.nasa.gov/naif/)
- [NASA NSSDCA](https://nssdc.gsfc.nasa.gov/)
- [Planetary Society - Every Moon Mission](https://www.planetary.org/space-missions/every-moon-mission)
- [Wikipedia - List of Missions to the Moon](https://en.wikipedia.org/wiki/List_of_missions_to_the_Moon)

---

## Candidates for Adding to This Project

Based on HORIZONS availability and animation interest:

### High Priority (Confirmed Data)

| Mission | ID | Why Interesting |
|---------|-----|-----------------|
| Artemis 1 (Orion) | -1023 | First crewed lunar mission since Apollo |
| LRO | -85 | Long-duration active orbiter |
| GRAIL-A/B | -177, -181 | Tandem gravity mapping |
| LADEE | -12 | Different orbit type |
| CAPSTONE | -1176 | NRHO orbit (unique) |
| SLIM | -240 | Recent Japanese lander |
| KAGUYA | -131 | Japanese orbiter |
| SMART-1 | -238 | ESA ion propulsion |

### Medium Priority (Need Verification)

| Mission | Notes |
|---------|-------|
| IM-1 Odysseus | Commercial lander, check if data shared |
| Lunar Trailblazer | Recent mission, verify coverage |

### Lower Priority (Data Likely Unavailable)

| Mission | Notes |
|---------|-------|
| Chang'e series | CNSA doesn't share trajectory data |
| Luna 25 | Only stage tracked |
| Commercial landers | Data sharing varies |

---

*Document created: January 2026*
*Based on research from JPL HORIZONS, NAIF, NSSDCA, and public mission documentation*

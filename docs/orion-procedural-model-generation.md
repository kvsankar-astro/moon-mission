# Orion Procedural Model Generation Notes

Date: April 3, 2026

## Goal

Improve the in-scene Artemis 2 spacecraft from a rudimentary placeholder to a configurable Orion-like craft model without adding a heavy runtime GLTF dependency.

## Search And Reference Collection

### Search approach

1. Started with public-domain NASA Orion visual references.
2. Preferred orthographic renders because they are easier to match with procedural geometry (clear proportions, less perspective distortion).
3. Selected views that expose both body proportions and solar array layout.

### Primary references used

- https://commons.wikimedia.org/wiki/File:Orthographic_view_of_Orion_spacecraft,_left_side_with_solar_panels_(22734678907).png
- https://commons.wikimedia.org/wiki/File:Orthographic_view_of_Orion_spacecraft,_front_with_solar_panels_(23164761431).png
- https://commons.wikimedia.org/wiki/File:Orthographic_view_of_Orion_spacecraft,_top_with_solar_panels_(22734678457).png
- https://commons.wikimedia.org/wiki/File:Orthographic_view_of_Orion_spacecraft,_back_with_solar_panels_(22833021090).png
- https://commons.wikimedia.org/wiki/File:Orthographic_view_of_Orion_spacecraft,_bottom-front_with_solar_panels_(23128839505).png

### Local staging folder

References were downloaded locally for development iteration into:

`sandbox/reference/orion/`

## Implementation Approach

### Why procedural first

- Fast startup and no network dependency for craft geometry.
- Easy to tune proportions/colors directly in code.
- Works with the existing mission renderer and layer setup.

### Plugin architecture

Added/used plugin mapping in `SpacecraftRenderer`:

- `orion`
- `orion-procedural`

Both map to `createProceduralOrion(...)`.

### Model composition (procedural Orion)

The Orion plugin now builds the craft from grouped primitives:

1. Crew module frustum (capsule body).
2. White crew module adapter ring.
3. Forward docking hatch ring + center disk.
4. Side window/sensor pods around the forward section.
5. Service module cylinder with subtle ring banding.
6. Aft skirt + engine nozzle silhouette.
7. Four solar wings (90-degree spacing, 45-degree rotated set), each split into three segments with hinge details.

### Material direction

- Capsule: darker blue-gray metallic look (closer to Orion visuals).
- Adapter/service module: light gray/white.
- Solar wings: light gray segmented panels with frame/hinge accents.

## Wiring In Mission Config

Artemis 2 now enables this model through mission config:

```json
"spacecraftModel": {
  "enabled": true,
  "plugin": "orion-procedural",
  "options": {
    "scale": 1.0
  }
}
```

## Relevant Code Touchpoints

- `src/platform/js/rendering/spacecraft-renderer.js`
  - plugin registry
  - `createFromPlugin(...)`
  - `createProceduralOrion(...)`
- `src/platform/js/app/spacecraft-actions.js`
  - mission/craft-level model config resolution
  - plugin-based craft creation path
- `src/platform/js/core/domain/mission-config.js`
  - allow `spacecraftModel` as a known non-origin key
- `assets/artemis2/data/config.json`
  - Artemis 2 spacecraft model plugin config

## Runtime Behavior

- No runtime download is performed for this Orion craft plugin.
- Geometry and materials are generated in code at scene setup time.
- This keeps initial craft availability deterministic and lightweight.

## Next Iteration Ideas

1. Add optional RCS thruster clusters and antenna details.
2. Add subtle panel normal-map style variation procedurally or via lightweight textures.
3. Support mission-specific plugin options (array length, metallic levels, color theme).
4. Introduce optional high-detail GLTF override when available locally.

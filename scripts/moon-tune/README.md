# Moon Render Tuning Scripts

Headless Playwright harnesses used while iterating on the lunar photometric
shader and the per-profile render defaults under
`src/platform/js/rendering/moon-renderer.js` and
`src/platform/js/app/moon-render-asset-profiles.js`.

All scripts launch headless Chrome via the new headless mode (`--headless=new`)
and write PNGs to `tmp/moon-tune/shots/` (gitignored). Run the dev server first:

```
npx vite --port 7275
```

## Scripts

- `shoot.mjs` — Loads `moon-render-tuner.html`, applies a lighting/camera
  framing chosen to mimic the Artemis II Earth-rise reference, and applies
  any parameter overrides via the tuner's "Apply JSON" path. Use this when
  iterating on individual shader/material parameters in isolation.

  ```
  node scripts/moon-tune/shoot.mjs <label> '<json-overrides>'
  # Example:
  node scripts/moon-tune/shoot.mjs low-sun-test '{"primaryElevationDeg":4,"normalScaleX":1.6,"normalScaleY":1.6}'
  ```

  Env vars: `PROFILE` (`fast` | `quality`, default `fast`),
  `DRAG_DX`, `DRAG_DY` (camera pose drag deltas).

- `mission-shot.mjs` — Loads `mission.html?mission=artemis2` and screenshots
  the live scene + each auxiliary panel. Use this to verify per-view rendering
  (Craft to Moon, Earth to Moon, Frame and Shoot composer) picks up the same
  defaults.

  ```
  node scripts/moon-tune/mission-shot.mjs <preset> <label>
  # preset: free | earth | moon
  ```

- `probe.mjs` — Diagnostic probe for the tuner page. Captures the Three.js
  WebGL framebuffer center pixel via `gl.readPixels`, dumps failed network
  resources, and confirms the render loop is firing.

- `probe-mission.mjs` — Diagnostic probe for the mission scene. Reads live
  moon-material `userData` and shader uniforms to confirm the new defaults
  are applied to the running scene.

## Notes

- Headless GPU rendering of WebGL canvases is fragile under SwiftShader.
  These scripts use `channel: "chrome"` + `--headless=new` to get real Chrome
  with GPU acceleration. Without that, the WebGL framebuffer reads back
  black.
- The default lighting/camera framing in `shoot.mjs` is deliberately tuned
  for low-sun, oblique-limb shots — that is the regime where the new shader's
  terrain self-shadow path is most active. High-sun or full-disc views fall
  back to plain normal-map shading.

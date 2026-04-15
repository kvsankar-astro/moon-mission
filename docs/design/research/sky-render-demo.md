# Sky Render Demo

This repo now includes a standalone sky rendering demo page at:

- `/sky-render-demo.html`

It is intended as a sandbox for iterative development of the physically plausible sky pipeline (`SkyController`) without impacting mission runtime wiring.

## What It Demonstrates

- Atmosphere ON/OFF switching
- Time-of-day slider for sky rotation
- Observer latitude and longitude controls
- Star size, extinction, twinkle, and bloom-strength controls
- Clear visual distinction between ground-based and space-view modes

## Implementation Notes

- Script: `src/platform/js/sky-render-demo.js`
- Styles: `src/platform/css/sky-render-demo.css`
- If `src/platform/js/rendering/SkyController.js` is not available yet, the page falls back to a deterministic internal star renderer so the UI remains testable.


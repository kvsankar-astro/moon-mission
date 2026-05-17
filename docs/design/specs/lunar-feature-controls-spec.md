# Lunar Feature Controls Spec

Last updated: 2026-05-17

## Control Model

The Lunar Features pill opens a top-layer panel in both the main mission view and Frame and Shoot.

The panel has three tabs:

- Show All
- Hover
- Search

Tab-specific controls are structurally mounted only in the active tab. A control removed from a tab should not remain in that tab's panel body as a hidden element.

Show All and Hover each own an independent filter set. Changing one tab must not mutate the other tab's diameter range or feature-type filters.

## Show All Tab

Show All controls always-visible lunar feature annotations.

- Presets: None, Default, All.
- Diameter range remains visible.
- Filters remains visible and opens feature-type filters.
- Search controls are not mounted in this tab.
- Display controls are not mounted in this tab.

None disables Show All. Default and All enable Show All and apply the selected preset.

## Hover Tab

Hover controls pointer inspection of lunar features.

- Presets: None, Default, All.
- Diameter range remains visible.
- Filters remains visible and opens feature-type filters.
- Search controls are not mounted in this tab.
- Display controls are not mounted in this tab.

None disables Hover. Default and All enable Hover and apply the selected preset.

If Hover targets a feature that is already visible from Show All or Search, the existing annotation is highlighted instead of drawing duplicate labels or perimeter rings. The highlight uses a thicker boundary and slightly larger label.

## Search Tab

Search is additive. Search results are displayed on top of the annotations implied by Show All and Hover.

- Search shows only the search field and the search results panel.
- Search does not mount the preset buttons, diameter range, Filters control, or Display controls.
- Search result checkboxes pin or unpin matching features for the current search query.

If Search selects a feature already visible from Show All, the existing annotation is highlighted instead of drawing duplicate labels or perimeter rings.

## Rendering Rules

- Do not render duplicate labels for the same lunar feature.
- Do not render duplicate perimeter circles for the same lunar feature.
- Search and Hover highlights can reuse the same visible feature annotation.
- Search and Hover highlights should remain visible against the Moon surface without looking visually heavy.

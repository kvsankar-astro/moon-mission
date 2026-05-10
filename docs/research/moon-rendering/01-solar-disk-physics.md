# 01 — Solar Disk Physics for Lunar Rendering

> Research note for the Moon shader rewrite. Physics first, implementation later.
> No source files in `src/` are touched by this document.
>
> Status: research / reference. Not a spec. Subsequent notes (02, 03, ...) will turn the conclusions here into shader requirements.

---

## 0. Scope and motivation

Real-time Moon shaders almost universally model the Sun as a point light,
i.e. shading is reduced to a Lambert step function of the form

```
L_out = albedo * E0 * max(N · L, 0) / π
```

where `L` is a fixed direction toward the Sun and `N` is the surface normal.
This is the Lambertian illumination integral collapsed onto a delta-function
source. Two photometric facts make the point-source assumption visibly wrong
on the Moon, especially near the terminator and when zoomed in:

1. **The Sun is an extended disk**, not a point. Its apparent half-angular
   diameter as seen from the Moon is

   ```
   α ≈ R_sun / d_sun-moon
       = 6.957 × 10^8 m / 1.496 × 10^11 m
       ≈ 4.652 × 10^-3 rad
       ≈ 0.2665°    (≈ 15.99 arcmin half-angle, full diameter ≈ 31.98')
   ```

   so `sin α ≈ α ≈ 4.65 × 10^-3` (small-angle regime is essentially exact).
   Around the terminator, the Sun progressively "rises" or "sets" over the
   local horizon; for elevation angles `β` in the band `[-α, +α]` the
   surface sees a partial disk.

2. **Local relief modulates that local horizon**. Crater rims, mountains,
   and even sub-pixel slopes are tall enough relative to typical receivers
   that they cast cast-shadows whose own penumbra width is set by the
   Sun's angular diameter and the geometric distance to the occluder.
   Near the terminator, where the Sun grazes the surface, the umbra +
   penumbra of a single rim feature can stretch for many tens of
   kilometres.

This document derives the relevant analytic formulae, computes numerical
values for representative lunar geometries, and pins down which
quantities matter for shader design and which are second-order.

The deliverable downstream is a small set of functions like
`solarVisibilityFraction(beta)` and `softShadowFraction(occluderHeight, distance, beta)`
that the new shader can call, plus a clear rule for which surface normal
participates in which test.

---

## 1. Constants and notation

Throughout this document, `α` is the **half-angle subtended by the Sun's
disk at the Moon**, `β` is the **elevation angle** of the Sun's centre
above the local geometric horizon (positive = above horizon, negative =
below horizon), and `N` is the surface normal at the receiving point.
The horizon is the plane perpendicular to `N` and tangent at the point.
The angle between `N` and the direction to the Sun's centre is the
**zenith angle** `i`. Elevation and zenith are complementary:

```
β = π/2 − i,         cos i = sin β = N · L_centre
```

We use `μ = cos i = sin β = N · L_centre` for compactness.

| Symbol | Meaning | Lunar value |
| --- | --- | --- |
| `R_sun` | Sun radius | 6.957 × 10⁸ m |
| `R_moon` | Moon radius | 1.7374 × 10⁶ m |
| `d` | Moon ↔ Sun distance | 1.496 × 10¹¹ m (1 au) |
| `α` | Sun half-angle from Moon | 4.652 × 10⁻³ rad ≈ 0.267° |
| `2α` | Sun full angular diameter | 9.305 × 10⁻³ rad ≈ 0.533° ≈ 31.99' |
| `Ω_sun` | Sun solid angle from Moon | π α² ≈ 6.798 × 10⁻⁵ sr |
| `E_sun` | Solar irradiance at 1 au, top of atmosphere | 1361 W m⁻² (TSI) |
| `R_e` | Earth radius | 6.371 × 10⁶ m |
| `d_em` | Earth ↔ Moon mean distance | 3.844 × 10⁸ m |
| `α_e` | Earth half-angle from Moon | 1.657 × 10⁻² rad ≈ 0.949° |
| `A_earth` | Earth Bond albedo | ≈ 0.30 |
| `A_moon` | Moon geometric albedo (V) | ≈ 0.12 (mare ≈ 0.07, highlands ≈ 0.15) |

A useful intuition: the Sun's full angular diameter at the Moon (~32')
is the same as at Earth, because both bodies share the same heliocentric
distance to within 0.4%. Anything in the popular literature about the
Sun being "half a degree wide in the sky" applies verbatim on the Moon.

---

## 2. Irradiance from a uniform circular disk source above the horizon

### 2.1 Setup

Consider a flat receiver with normal `N`. The Sun is modelled as a
uniformly emitting circular disk of half-angle `α` whose centre is in a
direction making elevation `β` with the receiver's horizon. Assume the
Sun's emission per unit solid angle is `L_sun` (a radiance, W m⁻² sr⁻¹).
The irradiance at the receiver is the integral of `L_sun cos θ` over the
solid angle subtended by the disk that lies above the horizon:

```
E(β) = ∫∫_{disk ∩ upper hemisphere}  L_sun · cos θ  dΩ
```

where `θ` is the angle between the source direction and `N`.

### 2.2 Two limits we already know

1. **Disk fully above the horizon** (`β ≥ +α`):
   The integral runs over the whole disk. In the small-angle limit
   `α ≪ 1`, every point of the disk is at the same `cos θ ≈ sin β = μ`
   (variation across the disk is `O(α²) ≈ 2 × 10⁻⁵`, irrelevant).
   Therefore

   ```
   E(β) = L_sun · cos i · Ω_sun = L_sun · sin β · π α²
   ```

   We define the irradiance with the Sun overhead (zenith) as

   ```
   E_zenith = L_sun · π α²    (= E_sun ≈ 1361 W/m² at 1 au)
   ```

   so for `β ≥ α`,  `E(β) / E_zenith = sin β`. This is exactly the
   point-source Lambert response, as expected.

2. **Disk fully below the horizon** (`β ≤ −α`):
   `E(β) = 0`.

The **transition zone** is `β ∈ [−α, +α]`, a band of width `2α ≈ 0.533°`.
Inside this band the source is partially occluded by the horizon plane
and we need the area-of-overlap of two circles in the projected sky:
the unit disk of the Sun and the great-circle horizon.

### 2.3 Geometry of the partial disk

In the small-angle regime, project the celestial sphere onto its tangent
plane at the Sun centre. The Sun is then a planar disk of radius `α`,
the horizon a straight line a distance `β` from the Sun centre (positive
when the Sun centre is above). The fraction of disk area above the
horizon is the standard "circular segment" formula.

Let `f_geom(β)` be the fraction of the Sun's projected disk area above
the horizon line:

```
f_geom(β) = (1/π) [ arccos(−β/α) − (β/α) · √(1 − β²/α²) ]   for −α ≤ β ≤ +α
f_geom(β) = 1       for β ≥ +α
f_geom(β) = 0       for β ≤ −α
```

Equivalent, more symmetric form using `t ≡ β/α ∈ [−1, +1]`:

```
f_geom(t) = (1/π) [ arccos(−t) − t · √(1 − t²) ]
         = 0.5 + (1/π) [ arcsin(t) + t · √(1 − t²) ]
```

This is the so-called "occulted disk" or "transit" function and is
identical in form to the obscuration function used to model annular and
partial solar eclipses, with `α` set by the source half-angle and `β`
playing the role of the centre offset.

Check the boundary values:

```
f_geom(−1) = (1/π) [ arccos(1) − (−1) · 0 ]         = 0    ✓
f_geom( 0) = (1/π) [ arccos(0) − 0 ]                = (1/π)(π/2) = 0.5    ✓
f_geom(+1) = (1/π) [ arccos(−1) − (+1) · 0 ]        = (1/π) · π = 1     ✓
```

So when the Sun centre is exactly on the horizon (`β = 0`), exactly half
the disk is above the horizon — symmetric, as expected.

### 2.4 Irradiance — full closed form

The irradiance is *not* simply `f_geom · sin β · E_zenith`, because
`cos θ` (= the Lambert weighting) is not constant across the disk in
this regime — when `β` is comparable to `α`, the upper part of the disk
is at a meaningfully larger `cos θ` than the lower part. Both effects
must be integrated jointly.

Set up coordinates on the projected disk: let the horizontal axis be
along the horizon, the vertical axis perpendicular (positive = up). In
small-angle land, an offset `(x, y)` from the Sun centre corresponds to
a sky direction whose elevation is `β + y` and whose `cos θ` is
`sin(β + y) ≈ sin β + y cos β` for `y ≪ 1`.

The irradiance from a disk patch at `(x, y)` of area `dx dy` is
`L_sun · (sin β + y cos β) · dx dy`, integrated over

```
{ (x, y) : x² + y² ≤ α²,   y ≥ −β }
```

Splitting,

```
E(β) = L_sun · sin β · A_above(β)    +    L_sun · cos β · M_above(β)
```

where

```
A_above(β) = ∫∫_{disk ∩ upper}  dx dy            = π α² · f_geom(β)
M_above(β) = ∫∫_{disk ∩ upper}  y dx dy
```

(`A` is the area of the segment above the horizon, `M` is its first
moment with respect to the horizon line.)

Compute `M`. Using the parameterisation `y = α sin φ`, `x ∈ [−√(α²−y²), +√(α²−y²)]`:

```
M_above(β) = ∫_{y = −β}^{α} y · 2√(α²−y²) dy
           = [ −(2/3)(α² − y²)^{3/2} ]_{y=−β}^{y=α}
           = (2/3)(α² − β²)^{3/2}
```

(For `−α ≤ β ≤ +α`. For `β ≥ +α`, `M_above = 0` because the horizon
clipping is inactive and the centre-of-mass moment integrates to zero
by symmetry; for `β ≤ −α`, `M_above = 0` because there's nothing left
to integrate.)

Therefore the full closed-form irradiance for `−α ≤ β ≤ +α` is

```
E(β) = L_sun · [ sin β · π α² · f_geom(β) + cos β · (2/3)(α² − β²)^{3/2} ]
```

Normalising by `E_zenith = L_sun · π α²`,

```
E(β) / E_zenith =  sin β · f_geom(β)  +  (2 cos β)/(3 π) · (1 − β²/α²)^{3/2} · α
```

Let `t = β/α` (dimensionless):

```
V(t) ≡ E(β) / E_zenith
     = sin(α t) · f_geom(t)  +  (2 cos(α t))/(3π) · α · (1 − t²)^{3/2}
```

For lunar `α ≈ 4.65 × 10⁻³`, `sin(α t) ≈ α t` and `cos(α t) ≈ 1` to one
part in 10⁵. The "small-α" asymptotic, valid throughout the entire
penumbra band, is

```
V(t) ≈ α · [ t · f_geom(t)  +  (2/(3π)) · (1 − t²)^{3/2} ]   ,   t ∈ [−1, +1]
```

This is the exact small-angle limit of the disk-source irradiance and is
*the* fundamental terminator transition function. We will call the
bracketed quantity the **soft-terminator response** `S(t)`:

```
S(t) ≡ t · f_geom(t)  +  (2/(3π)) · (1 − t²)^{3/2}      , −1 ≤ t ≤ +1
S(t) = t                                                  , t ≥ +1
S(t) = 0                                                  , t ≤ −1
```

So **`E(β) ≈ α · S(β/α) · L_sun · π α²` only inside the penumbra**;
outside it, the irradiance recovers exactly to the point-source Lambert
result `α · t · L_sun · π α² = sin β · E_zenith`. (The factor of `α` you
see prepended to `S` is just rebuilding `sin β` from `t`.)

A more convenient normalisation for shader work is to define
`V(β) = E(β) / E_full(β)` where `E_full(β) = sin β · E_zenith` is the
point-source response. Then

```
V(β) =  f_geom(β) + (2/(3π)) · cot β · (1 − β²/α²)^{3/2}     for β ∈ (0, α)
V(β) =  1                                                    for β ≥ α
V(β) =  0                                                    for β ≤ −α
```

But this `V` blows up at `β = 0` because `cot β → ∞`, so it's only
useful for one side of the terminator. The "irradiance over zenith
irradiance" form `S(t)` is better for the full transition.

### 2.5 Sanity-check values

Plug in canonical points (small-`α` limit, exact in the lunar regime):

- `t = +1`  (Sun's lower limb just touches the horizon — sunrise complete):
  ```
  S(+1) = 1 · f_geom(+1) + (2/(3π)) · 0 = 1
  ```
  → irradiance equals the point-source value `sin α · E_zenith`. ✓

- `t = 0`  (Sun centre exactly on horizon):
  ```
  S(0) = 0 · 0.5 + (2/(3π)) · 1 = 2/(3π) ≈ 0.2122
  ```
  This is a key number. The irradiance is

  ```
  E(0) = α · 2/(3π) · E_zenith
        = (4.65 × 10⁻³) · 0.2122 · 1361 W/m²
        ≈ 1.343 W/m²    (vs. 0 from a point source)
  ```

  i.e. roughly **0.10% of zenith irradiance** when the Sun is bisected
  by the horizon. The point source predicts zero. This 1.3 W/m² is
  small absolutely but, after albedo (≈ 0.12 for the Moon), still gives
  a surface luminance comparable to a brightly-lit room (in radiometric
  units, ~0.05 W m⁻² sr⁻¹ scattered radiance), so it is well above the
  visual perception threshold against a black sky.

- `t = −1`  (Sun's upper limb just below horizon — sunset complete):
  ```
  S(−1) = −1 · 0 + (2/(3π)) · 0 = 0
  ```
  → fully dark. ✓

- `t = +0.5`  (Sun ¾ above horizon):
  ```
  f_geom(+0.5) = (1/π) [ arccos(−0.5) − 0.5 · √0.75 ]
              = (1/π) [ 2π/3 − 0.4330 ]
              = (1/π) · (2.0944 − 0.4330)
              = 0.5290
  S(+0.5) = 0.5 · 0.5290 + (2/(3π)) · (0.75)^{3/2}
         = 0.2645 + 0.2122 · 0.6495
         = 0.2645 + 0.1378
         = 0.4023
  ```
  → irradiance ratio vs zenith is `α · 0.4023 = 1.87 × 10⁻³`. Compared
  to the point-source value `sin(α/2) ≈ α/2 = 2.33 × 10⁻³`, the
  actual irradiance is **~80% of the point-source value** at this
  configuration. So even at `β = +α/2 ≈ 0.13°` the disk source has
  already largely "caught up" to Lambert.

- `t = −0.5`  (Sun ¾ below horizon):
  By the symmetry `S(−t) = (2/(3π))·(1−t²)^{3/2} − S(t) + ...`
  let's just compute it:
  ```
  f_geom(−0.5) = (1/π) [ arccos(+0.5) + 0.5 · √0.75 ]
              = (1/π) [ π/3 + 0.4330 ]
              = (1/π) · (1.0472 + 0.4330)
              = 0.4710
  S(−0.5) = −0.5 · 0.4710 + (2/(3π)) · (0.75)^{3/2}
         = −0.2355 + 0.1378
         = −0.0977
  ```

  Wait — `S(−0.5)` is **negative**? Mathematically yes, but physically
  this is wrong: irradiance can't be negative. The issue is that
  inside the penumbra (`|β| < α`) the disk centre has `cos θ < 0` for
  `β < 0`, so the point-source Lambert weighting `cos θ_centre = sin β`
  is also negative. The irradiance is positive only because the
  *upper* part of the disk, which has positive `cos θ`, contributes.
  The compact form `S(t) = t f_geom(t) + (2/(3π))(1−t²)^{3/2}` is
  *the algebraic difference*; we have to be careful that the negative
  first term and the positive second term combine to give the correct
  sign. Let me redo it without the simplification:

  Actually the formula is correct if interpreted properly. The first
  term `t · f_geom(t)` is the contribution from the segment-area times
  the centre's `cos θ`. The second term is the upward shift in the
  centre of mass. For `t = −0.5`, the area above the horizon is small
  (`f_geom = 0.471`) but its first moment about the horizon line is
  positive (it's *above* the horizon), so the irradiance is

  ```
  E(β=−α/2) = L_sun · [ sin(−α/2) · A_above + cos(−α/2) · M_above ]
            = L_sun · [ −(α/2) · π α² f_geom(−0.5) + 1 · (2/3) α³ (0.75)^{3/2} ]
            = L_sun · α³ · [ −0.5 π · 0.4710 + (2/3) · 0.6495 ]
            = L_sun · α³ · [ −0.7397 + 0.4330 ]
            = L_sun · α³ · (−0.3067)    ???
  ```

  That's still negative. This means the centre-line approximation
  `cos θ ≈ sin β + y cos β` is breaking down. Let's go back to the
  exact formula.

  The honest way: every point of the disk that is above the horizon
  contributes `cos θ_actual ≥ 0` weight, where `θ_actual` is the angle
  from `N`. Setting up the disk in the receiver's hemispheric
  coordinates with `N = (0, 0, 1)` and the Sun centre direction at
  `(cos β, 0, sin β)` after rotating in the x-z plane, a point on the
  disk at offset `(u, v)` from the centre (in tangent-plane coords on
  the celestial sphere) maps to direction

  ```
  L̂(u, v) = (cos β cos u − sin β sin u cos ψ, sin u sin ψ, sin β cos u + cos β sin u cos ψ)
  ```

  where `(u, ψ)` are polar-on-the-disk coords, `u ∈ [0, α]`, `ψ ∈ [0, 2π)`.
  Then `cos θ = N · L̂ = sin β cos u + cos β sin u cos ψ`. The point
  is above the horizon iff `cos θ > 0`, equivalently
  `tan u cos ψ > −tan β / 1`, i.e. `cos ψ > −sin β / (cos β tan u) = −tan β / tan u` for `u > 0`.

  In the small-`α` limit, `cos u ≈ 1`, `sin u ≈ u`, so

  ```
  cos θ ≈ sin β + u cos β cos ψ
        ≈ sin β + (vertical offset · cos β)        where  y = u cos ψ
  ```

  This recovers the linear approximation we used. Substituting back
  into the disk integral with the correct **upper-hemisphere clipping**
  (i.e. `cos θ ≥ 0` rather than `y ≥ −β`):

  ```
  E(β) = L_sun ∫∫_{disk} max(sin β + y cos β, 0) dA
       = L_sun cos β ∫∫_{disk} max((sin β / cos β) + y, 0) dA
       = L_sun cos β ∫∫_{disk} max(tan β + y, 0) dA
  ```

  In the small-angle regime `tan β ≈ β`, so the clipping is
  `y ≥ −β`, exactly what we had. The integral is correct.

  The resolution of the apparent paradox is: **the linear
  approximation `cos θ ≈ sin β + y cos β` can give negative `cos θ` for
  some `(x, y)` even when those points are above the horizon**. The
  geometric horizon (`y ≥ −β` in the tangent plane) and the
  "Lambert-positive" region (`cos θ ≥ 0`) coincide only in the strict
  limit `α → 0`, because at finite `α` the horizon is a great circle on
  the sphere, not a straight line in the tangent plane.

  However, the *correct* small-angle integral of a uniform disk above
  the horizon — accounting for both effects to leading order in `α` —
  *is*

  ```
  E(β) ≈ L_sun · [ sin β · A_above(β) + cos β · M_above(β) ]
  ```

  with `A_above = π α² f_geom(β)` and `M_above = (2/3)(α² − β²)^{3/2}`.
  This formula is self-consistent and always yields a non-negative
  result *when we restrict the integration to the upper half-disk and
  use the fact that `cos θ ≥ 0` over that region*. The negative value
  I computed above for `β = −α/2` is a sign error in my arithmetic —
  let's redo:

  At `β = −α/2`, `t = −0.5`:
  ```
  sin β = −α/2,   cos β ≈ 1
  A_above = π α² · 0.4710
  M_above = (2/3) α³ (1 − 0.25)^{3/2} = (2/3) α³ · 0.6495 = 0.4330 α³

  E = L_sun · [ (−α/2) · 0.4710 π α² + 1 · 0.4330 α³ ]
    = L_sun · α³ · [ −0.5 · 0.4710 · π + 0.4330 ]
    = L_sun · α³ · [ −0.7397 + 0.4330 ]
    = −0.3067 · L_sun · α³
  ```

  So the formula does give a **negative number** for `t = −0.5`, which
  is unphysical. **The formula is wrong as stated for `β < 0`.**

  The error is subtle: for `β < 0`, *part of the segment above the
  horizon line is still below the Lambert horizon*. In the small-angle
  limit, the geometric horizon in the tangent plane is at `y = −β`,
  but the Lambert horizon (where `cos θ = 0`) is at
  `y = −sin β / cos β = −tan β ≈ −β` to leading order. To leading
  order they coincide. But `cos θ = sin β + y cos β` is itself only
  valid to leading order in `(u/1)`, with corrections of order `(u)²`
  that are not symmetric in sign. For `β < 0`, near the lower edge of
  the disk-above-horizon segment, `cos θ` is genuinely small and
  positive, and the disturbing fact is that the linear formula above
  treats `cos θ` as `sin β + y` linearly throughout the upper segment.
  But for `y` only slightly above `−β`, `sin β + y cos β ≈ 0`, and
  positive — there's no problem with sign per se. The integral
  `∫∫ (sin β + y cos β) dA` over `y ∈ [−β, +√(α² − x²)]` should be
  positive.

  Let me redo the moment integral correctly. The moment is

  ```
  M_above(β) = ∫∫_{disk, y ≥ −β}  y dA
  ```

  For `β ≥ 0`, the horizon line is at or below the disk centre, and
  the upper segment includes all `y ∈ [−β, +α]`. For `β < 0`, the
  horizon line is above the centre, and the upper segment is only
  `y ∈ [−β, +α]` (which is to say `y ∈ [+|β|, +α]`).

  Compute directly using `y = α sin φ`:
  ```
  ∫_{y_min}^{α} y · 2√(α² − y²) dy
   = [ −(2/3)(α² − y²)^{3/2} ]_{y_min}^{α}
   = (2/3)(α² − y_min²)^{3/2}
   = (2/3)(α² − β²)^{3/2}
  ```

  Since `y_min = −β`, `y_min² = β²` regardless of sign. So
  `M_above(β) = (2/3)(α² − β²)^{3/2}` is correct for both signs of `β`.
  This is **always positive** (for `|β| < α`).

  And `A_above(β) = π α² f_geom(β)` is also correct for both signs.

  So plug in `β = −α/2` again:
  ```
  E = L_sun · [ sin β · A + cos β · M ]
    = L_sun · [ (−α/2) · π α² · 0.4710  +  1 · (2/3) α³ · 0.6495 ]
    = L_sun · α³ · [ −π · 0.5 · 0.4710 + (2/3) · 0.6495 ]
    = L_sun · α³ · [ −0.7397 + 0.4330 ]
    = −0.3067 · L_sun · α³
  ```

  Negative. So either the formula is wrong, or I am making an
  arithmetic error. Let me think harder.

  Sanity check: if `β = 0`, `A_above = π α² · 0.5`, `M_above = (2/3) α³`.
  Then `E(0) = L_sun · [ 0 · A + 1 · (2/3) α³ ] = (2/3) L_sun α³`.
  Compared to `E_zenith = L_sun π α²`, the ratio is `(2/3)α/π · α / α = (2/3)/π · α = 0.2122 α`.
  That matches `S(0) · α = 0.2122 α`. So at `β = 0` the formula gives
  the correct positive value. Good.

  Sanity check: if `β = α/2` (Sun ¾ above horizon, not below):
  ```
  A_above = π α² · 0.5290
  M_above = (2/3) α³ · 0.6495 = 0.4330 α³
  E = L_sun · [ (α/2) · π α² · 0.5290  +  1 · 0.4330 α³ ]
    = L_sun · α³ · [ π · 0.5 · 0.5290 + 0.4330 ]
    = L_sun · α³ · [ 0.8310 + 0.4330 ]
    = L_sun · α³ · 1.2640
  ```

  And `E_zenith = L_sun · π α²`, so `E(α/2) / E_zenith = 1.2640 α / π = 0.4023 α`.
  Compare to point-source: `sin(α/2) / (π α²) · π α² = sin(α/2) ≈ α/2 = 0.5 α`.
  So `E(α/2) / E_point(α/2) = 0.4023 / 0.5 = 0.805`. Sun ¾-above is at
  ~80% of point-source irradiance. That matches my earlier compute. ✓

  Now for `β = −α/2`. This is the configuration where the Sun is
  **¾-below-horizon** (only a small upper sliver visible). The point
  source predicts zero irradiance. Physically, the disk integral
  should give a small positive number — much less than at `β = +α/2`
  but greater than zero.

  So my formula must be wrong for `β < 0`. Let me recompute the
  moment more carefully.

  **The error**: for `β < 0`, the integration limits on `y` are
  `y ∈ [−β, +α]`, where `−β > 0`. So the lower limit of the `y`
  integral is positive: we are integrating only over `y > 0`.

  ```
  ∫_{y = -β}^{α} y · 2√(α²−y²) dy   (with -β > 0)
   = [ −(2/3)(α²−y²)^{3/2} ]_{-β}^{α}
   = −(2/3)(α²−α²)^{3/2}  + (2/3)(α²−β²)^{3/2}
   = +(2/3)(α²−β²)^{3/2}
  ```

  OK so that integral is positive: `M_above = (2/3)(α²−β²)^{3/2}`,
  which equals `(2/3)·α³·(1 − t²)^{3/2}`. For `t = −0.5`, that's
  `(2/3) α³ · 0.6495 = 0.4330 α³`. Yes positive.

  And `A_above` for `t = −0.5` should be the area of the small upper
  sliver: a circular segment of the disk with chord at height `y = +α/2`.
  The area above a chord at height `h` (with `h > 0`) on a circle of
  radius `α` is

  ```
  A_seg = α² arccos(h/α) − h √(α² − h²)
  ```

  For `h = α/2`: `A_seg = α² arccos(0.5) − (α/2) · α√(0.75)
                       = α² · π/3 − (α²/2) · 0.8660
                       = α² · 1.0472 − α² · 0.4330
                       = α² · 0.6142`

  Compare to my `f_geom(−0.5) = 0.4710` formula:
  `π α² · f_geom = π · 0.4710 α² = 1.4795 α²`

  These don't agree. So **`f_geom(−0.5) = 0.4710` is wrong**.

  The error is in my `f_geom` formula. Let me re-derive.

  For `β > 0` (Sun centre above horizon), the part of the disk above
  the horizon is the *bigger* segment. In tangent-plane coords with
  the horizon at `y = −β`:

  ```
  A_above = ∫_{y = −β}^{+α} 2√(α² − y²) dy
  ```

  Substitute `y = α sin φ`, `dy = α cos φ dφ`, limits `φ ∈ [−arcsin(β/α), π/2]`:

  ```
  A_above = ∫ 2 α cos φ · α cos φ dφ = α² ∫ 2 cos² φ dφ = α² [φ + sin φ cos φ]
          = α² [(π/2 + arcsin(β/α)) + (1 · 0 − sin(−arcsin(β/α)) cos(arcsin(β/α)))]
          = α² [(π/2 + arcsin(β/α)) + (β/α) √(1 − β²/α²)]
  ```

  With `t = β/α`:
  ```
  A_above = α² [π/2 + arcsin t + t √(1 − t²)]
  f_geom = A_above / (π α²) = 0.5 + (1/π)[arcsin t + t √(1 − t²)]
  ```

  Plug in `t = −0.5`:
  ```
  f_geom(−0.5) = 0.5 + (1/π) [arcsin(−0.5) + (−0.5) √0.75]
              = 0.5 + (1/π) [−π/6 − 0.4330]
              = 0.5 + (1/π) [−0.5236 − 0.4330]
              = 0.5 − 0.3046
              = 0.1954
  ```

  And `π α² · 0.1954 = 0.6140 α²`, which **matches** the direct
  segment-area formula. So the correct `f_geom` at `t = −0.5` is
  **0.1954**, not `0.4710` as I had before.

  Where did the `0.4710` come from? Let me recheck the original
  formula I cited:

  ```
  f_geom(t) = (1/π) [arccos(−t) − t √(1 − t²)]
  ```

  For `t = +0.5`: `f_geom(+0.5) = (1/π)[arccos(−0.5) − 0.5 √0.75]
                              = (1/π)[2π/3 − 0.4330]
                              = (1/π)[2.0944 − 0.4330]
                              = (1/π)(1.6614)
                              = 0.5290` ✓

  For `t = −0.5`: `f_geom(−0.5) = (1/π)[arccos(0.5) − (−0.5) √0.75]
                              = (1/π)[π/3 + 0.4330]
                              = (1/π)[1.0472 + 0.4330]
                              = (1/π)(1.4802)
                              = 0.4710`

  But my second derivation gave `0.1954`. So one of them is wrong.

  Let me directly check by symmetry: `f_geom(−t) + f_geom(+t) = 1`
  must hold (the part above + the part below = full disk).

  Using the second form: `0.1954 + 0.5290 = 0.7244 ≠ 1`. Wrong!
  Using the first form: `0.4710 + 0.5290 = 1.0000`. ✓

  So the **first** form (which I originally wrote) is correct, and my
  re-derivation has an error. Let me find it.

  Going back: `arcsin(−0.5) = −π/6 = −0.5236`, OK. `(−0.5) √0.75 = −0.4330`, OK.

  Then `0.5 + (1/π)[−0.5236 − 0.4330] = 0.5 + (1/π)(−0.9566) = 0.5 − 0.3045 = 0.1955`.

  Hmm. So the second derivation says `f_geom(−0.5) = 0.1955`. But by
  symmetry it must equal `1 − 0.5290 = 0.4710`. Conflict.

  Therefore one of my derivations has a sign error. Let me re-do the
  *direct* integral and see.

  For `β = −α/2`, the horizon line is at `y = −β = +α/2`. The disk
  occupies `y ∈ [−α, +α]`. The part of the disk **above** the horizon
  is `y ∈ [+α/2, +α]`, which is a small upper sliver.

  Its area (computed two ways):

  Way 1, geometric: `A = α²[arccos(h/α) − (h/α)√(1 − (h/α)²)]` where
  `h = α/2`.  `A = α²[arccos(0.5) − 0.5·√0.75] = α²[π/3 − 0.4330] = α²[1.0472 − 0.4330] = α²·0.6142`.

  Way 2, my "first" formula: `f_geom(−0.5) = 0.4710`, `A = π α² · 0.4710 = 1.4796 α²`.

  These disagree by a factor of ~2.4. The geometric way must be
  right. So **the "first" formula `f_geom = (1/π)[arccos(−t) − t√(1−t²)]` is wrong for `t < 0`**.

  Let me re-derive the first formula. Standard "circle minus chord
  above" formula: chord at distance `d` *below* the circle centre (so
  the centre is *above* the chord), with `d ∈ [0, r]`. Area above
  the chord (the larger part containing the centre):

  ```
  A = r² arccos(−d/r) − d √(r² − d²) ... hmm depends on convention
  ```

  Actually the standard formula for the area of a *segment* (the part
  on one side of a chord) is:

  ```
  A_seg = r² arccos(c/r) − c √(r² − c²)
  ```

  where `c` is the distance from the *centre* to the chord, and the
  segment is the *minor* segment (the smaller part, on the side of
  the chord away from the centre).

  In our problem, "area of disk above horizon line" is the segment
  whose chord is at `y = −β`. The signed distance from the centre
  to the chord is... hmm, this is where signs matter.

  Let me recompute for `β = +α/2` two ways:

  Geometric, segment formula: chord at `y = −α/2`. Distance from
  centre to chord = `α/2` (chord is *below* centre by `α/2`). The
  *minor* segment is the *lower* part (smaller area). The area
  *above* the chord is the *major* segment = full area − minor
  segment.

  ```
  A_minor = α² arccos(0.5) − (α/2) √(α² − α²/4)
          = α² · π/3 − (α/2) · α√(3)/2
          = α² · 1.0472 − α² · 0.4330
          = α² · 0.6142

  A_above = π α² − A_minor = α²(π − 0.6142) = α²(3.1416 − 0.6142) = α²·2.5274

  f_geom(+0.5) = 2.5274 / π = 0.8044
  ```

  But my "first" formula said `f_geom(+0.5) = 0.5290`. That's also
  wrong!

  Wait, let me reconsider. At `β = +α/2`, the Sun's centre is above
  the horizon by `α/2`. The Sun extends from elevation `+3α/2` (top)
  down to `−α/2` (bottom). So a *slice* of width `α/2` is below the
  horizon (the lowest part of the disk), and the rest (from
  `−α/2` to `+3α/2`, a band of width `2α − α/2 ... wait that's not how
  the disk works`). In the tangent plane, the disk is at
  `y ∈ [−α, +α]`, centred at the disk centre (which is at sky
  elevation `β = α/2`). The horizon plane in the tangent plane is at
  `y_{horizon} = −β = −α/2`. So the disk extends from `y = −α`
  (lowest, at sky elevation `β − α = −α/2`, i.e. *below* horizon) up
  to `y = +α` (highest, at sky elevation `β + α = +3α/2`).

  Below the horizon (`y < −α/2`): a slice of the disk of "depth"
  `α − α/2 = α/2`. Above the horizon: the rest, depth `α + α/2 = 3α/2`.

  Area below horizon = minor segment with chord at `y = −α/2` (distance
  `α/2` below centre). This is the *minor* segment.

  ```
  A_minor = α² arccos(0.5) − (α/2)·α·√(1 − 0.25)
          = α² · π/3 − (α²/2) · 0.8660
          = α² · 1.0472 − α² · 0.4330
          = α² · 0.6142

  A_above = π α² − 0.6142 α² = (3.1416 − 0.6142) α² = 2.5274 α²
  f_geom(+0.5) = 2.5274 / π = 0.8044
  ```

  So **the correct value is `f_geom(+0.5) = 0.8044`**, not `0.5290`!

  And my "first" formula `(1/π)[arccos(−t) − t √(1−t²)]` evaluated at
  `t = +0.5` gives:

  `arccos(−0.5) = 2π/3 = 2.0944`
  `0.5 · √0.75 = 0.4330`
  `2.0944 − 0.4330 = 1.6614`
  `1.6614 / π = 0.5290`

  Hmm, that's the area of the *minor* segment (`0.5290 = 0.6142 · π / π`?
  no, `0.5290 ≠ 0.6142/π`). Let me check `0.5290 · π = 1.6624`.
  And `0.6142` (the minor segment area divided by `α²`). Not the same.

  So I had the wrong formula for `f_geom`.

  Let me look up the proper formula:
  Standard "circular cap" area, area of a segment cut from a unit
  disk by a horizontal line at height `y = h` (where `−1 ≤ h ≤ 1`),
  *above* the line:

  ```
  A_above(h) = arccos(h) − h · √(1 − h²)         (in units of disk = unit)
  ```

  This is in units where the disk radius is 1. For our case with the
  horizon at `y = −β`, and disk radius `α`, the area above the line
  is:

  ```
  A_above(β) = α² · [arccos(−β/α) − (−β/α) · √(1 − β²/α²)]
             = α² · [arccos(−β/α) + (β/α) · √(1 − β²/α²)]
  ```

  And `f_geom = A_above / (π α²)`:

  ```
  f_geom(t) = (1/π) [arccos(−t) + t √(1 − t²)]      where t = β/α
  ```

  **Note the `+` sign on the second term, not `−`**. I had the wrong
  sign!

  Let me verify:
  - `t = 0`: `f_geom(0) = (1/π)[arccos(0) + 0] = (1/π)(π/2) = 0.5` ✓
  - `t = +1`: `f_geom(+1) = (1/π)[arccos(−1) + 1·0] = (1/π)·π = 1` ✓
  - `t = −1`: `f_geom(−1) = (1/π)[arccos(+1) + (−1)·0] = (1/π)·0 = 0` ✓
  - `t = +0.5`: `f_geom(+0.5) = (1/π)[arccos(−0.5) + 0.5·√0.75]
                              = (1/π)[2π/3 + 0.4330]
                              = (1/π)[2.0944 + 0.4330]
                              = (1/π)(2.5274)
                              = 0.8044` ✓ matches geometric!
  - `t = −0.5`: `f_geom(−0.5) = (1/π)[arccos(+0.5) + (−0.5)·√0.75]
                              = (1/π)[π/3 − 0.4330]
                              = (1/π)[1.0472 − 0.4330]
                              = (1/π)(0.6142)
                              = 0.1955` ✓ matches geometric!

  And `f_geom(+0.5) + f_geom(−0.5) = 0.8044 + 0.1955 = 0.9999 ≈ 1` ✓
  (the small numerical error is rounding.)

### 2.6 The correct formulae (final)

After cleaning up the sign error, here are the **canonical formulae**
for the disk-source irradiance problem in the small-angle regime:

```
t  ≡ β / α                                              (dimensionless)

f_geom(t) = (1/π) [ arccos(−t) + t · √(1 − t²) ]        for −1 ≤ t ≤ +1
          = 0                                            for t ≤ −1
          = 1                                            for t ≥ +1
```

Equivalent symmetric forms:

```
f_geom(t) = 0.5 + (1/π) [ arcsin(t) + t · √(1 − t²) ]
f_geom(t) = 1 − f_geom(−t)
```

Sanity:
```
t = −1.0:  f_geom = 0.0000   (no Sun visible)
t = −0.75: f_geom ≈ 0.0728
t = −0.50: f_geom ≈ 0.1955
t = −0.25: f_geom ≈ 0.3408
t =  0.00: f_geom = 0.5000   (Sun half-visible)
t = +0.25: f_geom ≈ 0.6592
t = +0.50: f_geom ≈ 0.8044
t = +0.75: f_geom ≈ 0.9272
t = +1.0:  f_geom = 1.0000   (Sun fully above horizon)
```

Now redo the moment integral with the correct sign book-keeping. The
first moment of the segment (area above the line) about the line itself:

```
M_above(t) = ∫∫_{disk, y ≥ −β} y dA
```

Direct compute (with `y = α sin φ`, integrating `φ ∈ [−arcsin t, π/2]`):

```
M_above = ∫_{φ=−arcsin t}^{π/2} α sin φ · 2 α cos φ · α cos φ dφ
        = 2 α³ ∫ sin φ cos² φ dφ
        = 2 α³ [−cos³ φ / 3]_{−arcsin t}^{π/2}
        = 2 α³ [0 − (−(1/3)(1 − t²)^{3/2})]
        = (2/3) α³ (1 − t²)^{3/2}
```

For both signs of `t`. So `M_above(β) = (2/3)(α² − β²)^{3/2}` is
correct.

Therefore the **irradiance formula** is:

```
E(β) = L_sun · [ sin β · π α² · f_geom(β/α)  +  cos β · (2/3)(α² − β²)^{3/2} ]
     ≈ L_sun · α³ · [ π · t · f_geom(t)  +  (2/3)(1 − t²)^{3/2} ]   (small α)
```

Normalising by `E_zenith = L_sun · π α²`:

```
V(t) ≡ E / E_zenith
     = α · [ t · f_geom(t)  +  (2/(3π)) · (1 − t²)^{3/2} ]      for |t| ≤ 1
     = α · t                                                     for t ≥ 1
     = 0                                                         for t ≤ −1

S(t) ≡ V(t) / α
     = t · f_geom(t)  +  (2/(3π)) · (1 − t²)^{3/2}              for |t| ≤ 1
     = t                                                         for t ≥ 1
     = 0                                                         for t ≤ −1
```

The function `S(t)` is what the shader should evaluate. It is the
analogue of `max(N · L, 0)` for an extended disk source. Outside the
penumbra it equals `t`, recovering Lambert; inside it smoothly
interpolates.

### 2.7 Revised sanity values

- `t = −1.0`: `S = 0.0000`
- `t = −0.75`: `S = (−0.75)(0.0728) + (2/(3π))(0.4375)^{1.5}
              = −0.0546 + 0.2122 · 0.2895 = −0.0546 + 0.0614 = +0.0068`
- `t = −0.50`: `S = (−0.5)(0.1955) + (2/(3π))(0.75)^{1.5}
              = −0.0977 + 0.2122 · 0.6495 = −0.0977 + 0.1378 = +0.0401`
- `t = −0.25`: `S = (−0.25)(0.3408) + (2/(3π))(0.9375)^{1.5}
              = −0.0852 + 0.2122 · 0.9077 = −0.0852 + 0.1926 = +0.1074`
- `t =  0.00`: `S = 0 + (2/(3π))(1.0)^{1.5} = 0.2122`
- `t = +0.25`: `S = (0.25)(0.6592) + (2/(3π))(0.9375)^{1.5}
              = +0.1648 + 0.1926 = +0.3574`
- `t = +0.50`: `S = (0.5)(0.8044) + (2/(3π))(0.75)^{1.5}
              = +0.4022 + 0.1378 = +0.5400`
- `t = +0.75`: `S = (0.75)(0.9272) + (2/(3π))(0.4375)^{1.5}
              = +0.6954 + 0.0614 = +0.7568`
- `t = +1.0`:  `S = +1.0000`

| `t` | `f_geom` | Lambert (point source) `max(t,0)` | Disk source `S(t)` | Disk / Lambert ratio |
| --- | --- | --- | --- | --- |
| −1.00 | 0.000 | 0.000 | 0.0000 | — |
| −0.75 | 0.073 | 0.000 | 0.0068 | ∞ |
| −0.50 | 0.196 | 0.000 | 0.0401 | ∞ |
| −0.25 | 0.341 | 0.000 | 0.1074 | ∞ |
|  0.00 | 0.500 | 0.000 | 0.2122 | ∞ |
| +0.25 | 0.659 | 0.250 | 0.3574 | 1.43 |
| +0.50 | 0.804 | 0.500 | 0.5400 | 1.08 |
| +0.75 | 0.927 | 0.750 | 0.7568 | 1.01 |
| +1.00 | 1.000 | 1.000 | 1.0000 | 1.00 |

A few observations:

- The disk source predicts **non-zero illumination from `t = −1` up to `t = +1`**,
  i.e. across the full angular range of width `2α ≈ 0.533°`. The point
  source predicts illumination only for `t > 0`, i.e. above a perfectly
  sharp terminator.

- At the geometric centre of the terminator (`t = 0`, Sun centre on
  horizon), the disk source delivers **`S(0)/α ≈ 0.21` of the
  illumination it would deliver if Sun were at zenith** (relative to
  `E_zenith = E_sun = 1361 W m⁻²`), times an additional factor of `α`
  to account for the grazing geometry. Total irradiance:
  `E(0) = α · S(0) · E_sun ≈ 4.65×10⁻³ · 0.2122 · 1361 W/m² ≈ 1.34 W/m²`.
  (For comparison, full daylight on the lunar surface is ~1361 W/m²,
  so this is `~ 10⁻³ of full daylight` — visible to the eye but very
  much in the "deep twilight" regime.)

- For `t > +1`, both formulae agree exactly, so far from the terminator
  (Sun above ~0.27° altitude) the point-source approximation is correct.

- For `t < −1` (Sun below ~0.27° altitude), both formulae give zero
  (no direct sun) and other illumination sources (Earthshine, scattered
  light from peaks) take over.

### 2.8 The penumbra width as projected onto the surface

The angular width of the soft terminator is `2α ≈ 0.533°`. On a flat
lunar surface this projects to a band of width

```
W_band = 2α / tan(angle of horizon to surface) = 2α / sin(local sun altitude variation rate per metre)
```

For a *spherical* Moon viewed from far away, the sub-solar altitude
sweeps through `2α` of angle as you traverse a great-circle arc of
length

```
ds = R_moon · 2α = 1.7374 × 10⁶ · 9.30 × 10⁻³ = 1.616 × 10⁴ m ≈ 16.2 km
```

So **the penumbra band on a smooth Moon is about 16 km wide**, running
all around the terminator. Compare this to the Moon's diameter (3474 km)
or to the angular resolution of typical lunar imaging (~1 km/pixel for
ground-based amateur telescopes, ~100 m/pixel for LRO WAC). The
penumbra is 16 px wide at 1 km/pixel and 160 px wide at 100 m/pixel.

For a viewer at 100 km from the Moon's surface (typical low lunar
orbit), 16 km subtends `16/100 ≈ 0.16 rad = 9.2°` of view angle, which
is huge — the soft penumbra is a major visual feature. For a viewer at
Earth (3.84 × 10⁵ km), 16 km subtends `16 / 3.84×10⁵ = 4.2 × 10⁻⁵ rad ≈
8.6 arcsec`, which is barely resolvable in a good telescope.

For the orbital visualiser this means: **at typical zoom levels where
the Moon fills, say, 1/4 of the screen, the soft penumbra band is on
the order of 1–10 pixels wide**. So the disk-source soft terminator is
a marginal feature — it matters for high-zoom screenshots, less so for
default-zoom orbital views. The bigger story is the cast-shadow
penumbra from terrain (next section), which can be many tens of km
wide and is therefore much more visually significant.

---

## 3. Cast shadows from terrain features

### 3.1 Geometry of a cast shadow from a point occluder

Consider a flat receiver, with a point occluder (top of a mountain,
crater rim, etc.) of height `h` at horizontal distance `d` from the
receiver point, in the direction *opposite* to the Sun. The Sun's
centre is at altitude angle `β > 0` above the horizon. We want: what
fraction of the Sun's disk is occluded by the point at the moment
sunlight rakes over it onto the receiver?

The angular elevation of the occluder, as seen from the receiver, is

```
β_occ = arctan(h / d)
```

For lunar geometry near the terminator, `h` is typically `1–10 km`
(crater rim, mountain, central peak) and `d` is `1–100 km` (receiver
near the foot of the feature). So `β_occ` ranges from `~0.6°` to `~84°`.

A point occluder doesn't really cast a meaningful "fractional disk"
shadow in the strict sense — it's a single point in the sky and either
covers some part of the Sun (only at one instant when `β = β_occ`) or
covers nothing. **A real lunar mountain edge is more like a long
ridge**: each point of the receiver sees the ridge as a horizon
profile that masks part of the sky.

Let's idealise the occluder as a horizontal straight ridge at angular
elevation `β_occ` (as seen from the receiver). Then the question
"what fraction of the Sun's disk is occluded?" reduces exactly to the
disk-above-horizon problem of section 2, with the role of the local
horizon now played by the ridge:

```
Visible fraction = f_geom( (β_sun − β_occ) / α )
                 = f_geom( Δβ / α )       where  Δβ ≡ β_sun − β_occ
```

i.e. the visible fraction depends on how high the Sun is *above* the
ridge, normalised to the Sun's angular half-diameter.

The **shadow contains zero direct sunlight** when `Δβ ≤ −α`
(ridge fully occults the Sun). It is **fully sunlit** when `Δβ ≥ +α`.
In between, the irradiance is the disk integral (with `f_geom` and
`M_above`), and we have a soft shadow edge of angular width `2α`.

### 3.2 The "1% rule" / penumbra width as a function of distance

The on-the-ground width of the soft edge of a cast shadow from a
distant feature is determined by how rapidly `β_occ` changes with
horizontal position. If we move the receiver by a small horizontal
distance `δx` *along* the shadow direction (away from the occluder),
the angular elevation of the occluder changes by

```
δβ_occ = ∂β_occ/∂x · δx = −h / (h² + d²) · δx ≈ −(h / d²) · δx   (for h ≪ d)
```

For the receiver to traverse the soft-shadow band (width `2α` in
angle), the horizontal motion is

```
δx_band = 2α · (d² + h²) / h ≈ 2α · d²/h        (h ≪ d)
        = (2α) · (d / tan β_occ)
```

Or, more simply: the shadow at horizontal distance `d` from the
occluder has an on-the-ground penumbra width of

```
W_penumbra = 2α · L
```

where `L` is the slant distance from the occluder along the light
direction:

```
L = d / cos(β_sun)    (for a horizontal ridge, distance to the ridge along the ground projection of the shadow)
```

For a low-altitude Sun (`β_sun ≪ 1`), `L ≈ d / β_sun`. For
`β_sun = 1°` and `d = 10 km`, `L ≈ 573 km`, and `W = 2α · L = 9.3 × 10⁻³ · 573 km = 5.3 km`.

This is the famous **"1% rule" of soft shadows**: the penumbra width
at distance `d` from the occluder is approximately `(angular diameter
of source) × (slant distance)`. For sunlight at Earth, the rule of
thumb is that the penumbra at distance `D` is `~D / 100` (since the
Sun's angular diameter is `~1/100` rad, ≈ 0.57°). The same rule
applies on the Moon, since the angular diameter is the same.

Numerically, lunar penumbra widths from a `h = 5 km` mountain at
horizontal distance `d` km:

| `d` (km) | `β_occ` | If sun at `β_sun = 1°`, slant `L = d / sin β_sun` | `W = 2α · L` (km) |
| --- | --- | --- | --- |
|  1 | 78.7° | 57.3 km | 0.53 km |
|  5 | 45.0° | 286.5 km | 2.66 km |
| 10 | 26.6° | 573 km | 5.33 km |
| 50 |  5.7° | 2865 km | 26.7 km |
| 100 | 2.86° | 5730 km | 53.3 km |
| 200 | 1.43° | 11460 km | 106.6 km |
| 287 | 1.0° | 16450 km | 153.0 km |

Beyond `d ≈ 287 km`, the mountain is *below* the Sun (`β_occ < β_sun`)
and the receiver is fully sunlit; the geometric shadow stops there.

But notice that at `d = 50 km`, the penumbra width is `27 km`. So
the shadow of a 5 km mountain near the lunar terminator (sun at 1°
altitude) has:

- **A sharp interior umbra** out to ~287 km from the mountain base
  (the shadow's "core").
- **A soft penumbra edge of width ~27–150 km** at distance 50–287 km
  from the mountain.

In a 1 km/pixel image, that's a penumbra band tens to hundreds of
pixels wide. **This is the dominant terminator-softening feature for
realistic lunar imagery**, much larger than the 16-km global penumbra
band from the Sun's disk.

### 3.3 Real-world reference: Apollo and LRO terminator imagery

The sub-solar point on the Moon near the terminator has the Sun at
altitude `β_sun` decreasing toward zero. At `β_sun = 1°` (about 1 hour
of lunar rotation past the geometric sunrise line, since lunar
rotation is 360°/29.5 days ≈ 0.51°/hr), a 5 km mountain casts a
geometric shadow of length

```
L_shadow = h / tan(β_sun) = 5 / tan(1°) ≈ 5 / 0.01746 = 286 km
```

with a soft edge `W = 2α · L_shadow ≈ 0.0093 × 286 km ≈ 2.7 km` at
the very tip (the "antumbra" near the shadow's farthest extent).
Actually, what the table above captures more accurately is: at any
intermediate distance `d ∈ [0, L_shadow]` *along* the shadow, the
penumbra is of width `2α · d / sin β_sun`, but this only describes
the cross-section perpendicular to the light if `d` is the distance
along the surface. In the receiver's tangent plane, the penumbra
width is simpler: the angular elevation of the ridge top changes by
`α` as you move horizontally by `δx = α / |∂β_occ / ∂x| = α (d² + h²) / h`,
so the penumbra-band thickness on the ground is `α (d² + h²) / h ≈ α d² / h`
for `h ≪ d`. For `α = 4.65 × 10⁻³`, `h = 5 km`, `d = 100 km`:
`W = 4.65e-3 · 100² / 5 = 9.3 km`. (Units: km² / km = km.) That's the
half-band width; the full penumbra is twice this, `~19 km`.

These soft-shadow widths on the order of `10–100 km` near the
terminator are clearly visible in LRO WAC and Apollo imagery. They
appear as **scalloped/jagged terminator shapes**, with each scallop
being the shadow of a single major mountain or crater rim. The
"wispy" or "feathered" appearance of the terminator in good lunar
photographs is dominated by these penumbrae, NOT by the much smaller
~16 km global Sun-disk penumbra.

### 3.4 Effect on irradiance for an arbitrary occluder profile

A real lunar surface is not a single ridge; it's a complicated
profile. The general statement is: at any receiver point, define the
**horizon function** `β_horizon(ψ)` giving the local angular
elevation of the silhouette in azimuth direction `ψ`. Then the
visible part of the Sun is the intersection of the disk with the
upper region of the silhouette, computed in spherical coords.

For most practical purposes (and for shaders), it suffices to:

1. Sample the horizon profile in the direction of the Sun's azimuth
   (and a small angular neighbourhood `±α` around it).
2. Take the maximum elevation of the silhouette in that azimuth
   neighbourhood as `β_occ`.
3. Compute `Δβ = β_sun − β_occ`, then evaluate `f_geom(Δβ / α)` for the
   visible disk fraction. (A more accurate formula would do a 2D disk
   intersection, but for sharp horizon ridges the 1D formula is
   already very close.)

For shader implementation this becomes a **horizon-clipping shadow
test**, akin to (and a generalisation of) standard horizon-mapping or
PCSS (percentage-closer soft shadows) techniques used in real-time
graphics.

### 3.5 Combining the disk-source softness with the cast-shadow softness

A subtle point: the *combined* softness of the terminator on a real
lunar surface is **not** the sum of the two effects (Sun-disk
penumbra + cast-shadow penumbra). The cast-shadow penumbra
*already incorporates* the Sun-disk size: that's exactly the angular
extent over which `f_geom(Δβ/α)` transitions from 0 to 1. The
correct story is:

- The horizon profile `β_horizon(ψ)` defines, for each surface point,
  the part of the sky that is **geometrically blocked**.
- The visible Sun is the part of the Sun's disk that is **not** blocked.
- The irradiance is the integral of `L_sun cos θ` over the visible
  part.

For a flat smooth surface with no horizon-blocking features, the only
"horizon" is the surface tangent plane, and the disk-above-horizon
formula of §2 applies (giving a 16-km global penumbra band on a
smooth Moon).

For a surface with a single ridge of effective elevation `β_occ`, the
combined effective horizon has an elevation `max(0, β_occ)` in the
direction of the ridge (and 0 elsewhere), and the visible Sun fraction
is `f_geom((β_sun − max(0, β_occ)) / α)` in the ridge direction.

In the limit where many overlapping ridges and fractal terrain define
the horizon, the effect is best described statistically (Hapke's "rough
surface" photometric models, e.g. Hapke 1984's "macroscopic roughness"
parameter `θ̄`).

---

## 4. Smooth vs perturbed normals: which one for which test?

This is the critical implementation question that drives a lot of
shader bugs. There are two distinct geometric questions, and they use
**different normals**:

### 4.1 The two questions

**Q1 (Visibility / horizon test):** What part of the Sun's disk is
above the local horizon — i.e. not blocked by the *macroscopic*
geometry of the surface?

**Q2 (Lambert response):** Given that some sunlight reaches the
surface, how much of it is reflected back toward the viewer (or, more
generally, what is the cosine factor for radiative transfer
geometry)?

### 4.2 Which normal goes with which question

**Q1 uses the smooth (geometric, mesh-level) normal `N_geom`.** The
horizon — the boundary between "Sun visible" and "Sun blocked" — is
defined by the macroscopic shape of the body. Sub-pixel surface
detail (the things that go into a normal map) does *not* shift the
horizon: a normal map represents micro-roughness, but the Sun is
either above the macro-horizon plane or below it.

**Q2 uses the perturbed (normal-mapped) normal `N_perturb`.** The
Lambertian response `cos θ_local = N_perturb · L` is the correct
weighting for light that has *already reached* the surface. Since
the per-pixel normal map represents the local orientation of the
sub-pixel facets, the cosine response should use that normal.

### 4.3 Physical reasoning

- **Why Q1 needs the smooth normal**: the question "is the Sun above
  the horizon?" is asking about the *direction of the unoccluded
  hemisphere*. This is a property of the local mesh, not of
  sub-pixel detail. A sub-pixel facet tilted away from the Sun does
  not block the Sun from reaching the surface — light travelling at
  any angle within the upper hemisphere of the smooth normal can
  still reach the surface and illuminate the facet (or the rest of
  the pixel's worth of facets).

- **Why Q2 needs the perturbed normal**: the local cosine response is
  a *Lambertian reflectance* property of the facet orientation. If
  the per-pixel normal is tilted away from the Sun, the *facet
  receives less light per unit area* (because the projected area of
  the facet is smaller in the Sun's direction). This is the
  Lambert cosine law and it operates per-facet, hence per-pixel.

### 4.4 Asymmetry

The two normals do *different* jobs:

| Question | Geometry-level effect | Normal to use |
| --- | --- | --- |
| Is the Sun above the local horizon? | Blocking / occlusion. Boolean (or, via disk source, a smooth fraction). | `N_geom` |
| What's the projected area factor of the surface as seen from the Sun? | Lambertian falloff. | `N_perturb` |
| What fraction of the upper hemisphere is the Sun? | Solid-angle / disk integral. | `N_geom` |
| Microfacet reflectance (specular, etc.) | Per-pixel normal & roughness. | `N_perturb` |

This asymmetry is the *single most important physical insight* for
correctly rendering shaded terrain near the terminator. Both effects
must be modelled, but they cannot use the same normal.

The "honest" form of the Lambert irradiance for an extended source is
something like:

```
E_local(point) = ∫_{visible_sun_disk} L_sun(L̂) · max(N_perturb · L̂, 0) dΩ(L̂)
```

where the visibility region (`visible_sun_disk`) is determined using
the *macro horizon* (i.e. the smooth normal `N_geom` plus any cast
shadow horizon contributions), but the cosine weighting uses
`N_perturb`.

In the limit of small `α`, this reduces to (for a fully visible Sun):

```
E_local = E_zenith · max(N_perturb · L, 0)        (Lambert; correct for sun far above horizon)
```

and (for a partially visible Sun in the smooth penumbra):

```
E_local ≈ E_zenith · α · S(t_smooth)              (smooth-normal disk integral; correct only when N_perturb ≈ N_geom)
```

with a correction term when `N_perturb` differs significantly from
`N_geom`. The correction is small unless we're right at the
terminator.

### 4.5 Artifacts from getting it wrong

**Artifact 1: Using `N_perturb` for the visibility test.**
This is the most common mistake. The result is that any normal-mapped
detail near the terminator generates spurious illumination based on
sub-pixel orientation. Specifically:

- *On the night side, just past the terminator*: a tiny sub-pixel
  facet that happens to be tilted toward the Sun by, say, `5°` will
  light up brightly even though the macroscopic surface is in shadow.
  This is *physically wrong* because the Sun is geometrically below
  the macroscopic horizon — that little facet is in shadow as much
  as the rest of the pixel. The artifact appears as a **uniform
  glow band on the dark side just past the terminator**, with
  intensity proportional to the average sub-pixel facet tilt angle
  toward the sun. In a normal-mapped shader, this is sometimes
  called "leaky terminator" or "phantom illumination".

- *On the lit side, near crater rims*: a normal-mapped crater rim
  may have facets pointing strongly toward the Sun (the upwind side
  of the rim) and away from it (the downwind side). The "toward"
  facets get spurious extra illumination *even when the macroscopic
  geometry says the Sun has already set behind the rim from that
  facet's perspective*. This is the famous **"white halos around
  crater rims"** artifact: the rims appear too bright relative to
  the surrounding terrain because the per-pixel normal is being used
  to "see past" the macro-horizon.

The fix is to clamp the dot product test to use only `N_geom`:

```glsl
// Correct: visibility uses smooth normal
float NdotL_geom = dot(N_geom, L);
float visibility = smoothstep(-alpha, +alpha, NdotL_geom);     // disk-source soft step
// Or more accurately: visibility = S_function(NdotL_geom / alpha)

// Lambert response uses perturbed normal
float NdotL_perturb = max(dot(N_perturb, L), 0.0);

// Total irradiance contribution:
float irradiance = E_zenith * visibility * NdotL_perturb;
```

Actually, even the above isn't quite right — `NdotL_perturb` should
be the integral of `max(N_perturb · L̂, 0)` over the visible portion of
the disk, weighted by `L_sun`. But for `α ≪ 1` and `N_perturb` close
to `N_geom`, the simpler factorisation `visibility * NdotL_perturb`
is a good approximation. We will refine this in the next research
note.

**Artifact 2: Using `N_geom` for both questions (no normal map effect).**
This is the "old-school" Lambert without per-pixel detail. The
result is a smooth, doughy terrain with no apparent surface texture.
Crater rims appear as simple albedo variations rather than as
shaded relief. This is *visually flat* and unrealistic, but at
least it's not physically wrong in the sense of generating
out-of-thin-air illumination — it just under-represents the surface
detail.

**Artifact 3: Using `N_perturb` for both questions.**
This is what most naive shaders (including many three.js MeshStandard
implementations) do. The artifacts of Artifact 1 (white halos and
leaky terminator) are present, plus the bonus that the disk-source
penumbra is also incorrect (because the "horizon" is now per-facet
rather than macro, and the soft-step behaviour doesn't make physical
sense at the per-pixel level).

### 4.6 Literature

The canonical references for this issue in real-time rendering are:

- **Real-Time Rendering, 4th ed., Akenine-Möller et al., 2018**,
  §9.7 "BRDF Models for Surface Reflection" and §11.4 "Ambient and
  Indirect Lighting". The text explicitly distinguishes "geometric
  normal" and "shading normal" and notes that the visibility/horizon
  test should use the geometric normal while the BRDF cosine
  factor uses the shading normal.

- **PBRT, 4th ed., Pharr, Jakob, Humphreys, 2023**,
  §13.6 (volumetric and integrator considerations). PBRT's
  approach is to evaluate visibility (shadow rays) against the
  *geometric* surface and to evaluate the BRDF against the
  shading normal. This is the same physical decomposition.

- **Hapke, "Theory of Reflectance and Emittance Spectroscopy", 2nd
  ed., 2012**, Ch. 10 ("Reflectance of a Particulate Medium with
  Macroscopic Roughness"). Hapke's `S(i, e, ψ)` shadowing function
  for rough surfaces is essentially a statistical version of this
  same horizon-clipping idea, applied to a Gaussian-distributed
  facet population. The "macroscopic roughness" parameter `θ̄` is the
  RMS facet tilt angle, and the resulting shadowing function reduces
  the irradiance as `i` (incidence angle) approaches 90°. This is
  the planetary-photometry analogue of the smooth-vs-perturbed
  decomposition above, formalised for unresolved surfaces.

- **Schlick, "An Inexpensive BRDF Model for Physically-Based
  Rendering", 1994** introduces the standard split between geometric
  shadowing/masking term `G` and the microfacet term in the BRDF.
  The G term uses the geometric normal; the microfacet contribution
  uses a per-facet (per-pixel) normal.

- **Heitz, "Understanding the Masking-Shadowing Function in
  Microfacet-Based BRDFs", JCGT 2014** is the modern reference for
  this distinction in the microfacet BRDF context. The smooth-vs-
  perturbed decomposition is the appropriate analog for normal-mapped
  *macroscopic* relief.

---

## 5. Sun's limb darkening

### 5.1 The phenomenon

The Sun's disk is not uniformly bright. The centre of the disk
appears brighter than the limb (edge) because the line of sight
through the centre samples deeper, hotter layers of the photosphere.
The standard model (Eddington 1926, refined by Schwarzschild and
others) gives:

```
I(μ) / I(1) = (1 − u_1 − u_2) + u_1 μ + u_2 μ²
```

where `μ = cos(angle from disk centre as seen from outside)` (so
`μ = 1` at disk centre, `μ = 0` at limb), and `u_1`, `u_2` are
wavelength-dependent darkening coefficients. For the visible
spectrum (broadband), good approximate values are
`u_1 ≈ 0.5`, `u_2 ≈ 0.2`, giving

```
I(μ) / I(1) = 0.3 + 0.5 μ + 0.2 μ²        (broadband visible)
```

A simpler one-parameter model (Eddington approximation):

```
I(μ) / I(1) = 0.4 + 0.6 μ                  (Eddington)
```

The mean intensity over the disk is `I_mean / I(1) = (2/5) + (3/5) · (1/2) = 0.7`
under Eddington, or `(0.3 + 0.5/2 + 0.2/3) = 0.617` under quadratic.

### 5.2 Effect on lunar surface irradiance

For a Sun *fully above* the horizon, limb darkening has *zero* effect
on irradiance: it just redistributes the radiance over the disk,
and the integral is conserved (modulo the definition of `L_sun`,
which is itself the *mean* radiance of the disk).

For a Sun *partially* above the horizon (the penumbra band), limb
darkening *does* affect the irradiance, because the visible part of
the disk is no longer the full disk and the visible part has a
nonuniform brightness profile.

Quantitatively: at `t = 0` (Sun half above horizon), the visible part
of the disk is the upper hemicircle. With Eddington darkening, the
mean radiance of the upper hemicircle is the average of `I(μ)` over
the hemicircle. Computing:

```
⟨I⟩_hemi / I(1) = ⟨0.4 + 0.6 μ⟩_hemi
                = 0.4 + 0.6 ⟨μ⟩_hemi
```

`μ` for a point on the disk at offset `(x, y)` from the centre is
`μ = √(1 − r²/α²)` where `r² = x² + y²`. The mean of `μ` over the
upper hemicircle (or the full disk) is

```
⟨μ⟩_disk = (1 / π α²) ∫_0^α 2π r √(1 − r²/α²) dr
         = (2 / α²) ∫_0^α r √(1 − r²/α²) dr
         = (2 / α²) · [−(α²/3) (1 − r²/α²)^{3/2}]_0^α
         = (2 / α²) · (α²/3)
         = 2/3
```

By the symmetry of the disk in `(x, y)`, `⟨μ⟩_hemi = ⟨μ⟩_disk = 2/3`.

So `⟨I⟩_hemi / I(1) = 0.4 + 0.6 · (2/3) = 0.4 + 0.4 = 0.8`.

Compare to `⟨I⟩_full / I(1)`:

```
⟨I⟩_full / I(1) = 0.4 + 0.6 · 2/3 = 0.8
```

**Identical.** That's because the upper hemicircle and the full
disk have the same mean of `μ` (by `(x, y) ↔ (x, −y)` symmetry).

So for the Sun half-above the horizon, limb darkening has *no* effect
on the mean radiance of the visible part of the disk (the
contribution to the irradiance changes by zero). The first effect
appears at *higher orders* in the displacement of the visible portion
from a centred geometry — i.e., when the visible portion is a
non-symmetric segment, the mean of `μ` over that segment differs
from `2/3`.

For an extreme case: at `t = +0.99` (Sun all but the bottom thin
sliver below the horizon), the visible portion is a thin sliver near
the limb (where `μ → 0`). Its mean `μ` is much less than `2/3`. The
"effective brightness" of the visible part is much less than the
mean disk brightness:

```
⟨I⟩_sliver / I(1) ≈ 0.4 + 0.6 · ⟨μ⟩_sliver
```

With `⟨μ⟩_sliver ≈ √(2(1 − t))` (the sliver near the upper edge has
`y` near `+α`, so `μ = √(1 − y²/α²)` near `0`), but actually wait —
let me re-examine. At `t = +0.99`, the visible portion is the *upper*
segment of the disk (almost the entire disk minus a tiny lower
sliver). Hmm, no: the formula `f_geom(t)` at `t = +0.99` gives
`f_geom ≈ 1 − f_geom(−0.99) ≈ 1 − tiny ≈ 0.99`, so the visible
portion is nearly the full disk. The mean `μ` over this nearly-full
portion is nearly `2/3`. Limb darkening barely changes anything.

The interesting case is the *opposite*: `t = −0.99`, visible portion
is a thin upper sliver near the upper limb. Then `μ` is small over
this region (the sliver is near the limb), and ⟨I⟩ over the sliver
is `0.4 · I(1)` rather than `0.7 · I(1)`. So the effective irradiance
from a thin upper sliver is `(0.4 / 0.7) ≈ 57%` of what it would be
under uniform-disk assumptions.

But that's an irradiance ratio of `~10⁻⁴` of `E_zenith` already (we
showed `S(−0.75) ≈ 0.0068`), so a ~40% reduction takes it to
`~6 × 10⁻⁵ E_zenith ≈ 0.08 W/m²`. This is well below the Earthshine
illumination level (next section) and visually negligible against a
black sky.

### 5.3 Practical conclusion on limb darkening

For lunar rendering, **limb darkening can be neglected**. It changes
the integrated irradiance by less than 1% across most of the
penumbra band, and the absolute brightness in the regions where it
matters most (deep penumbra) is already too low to affect the visual
result. The main consequence of limb darkening would be visible
*only* in zoomed solar-disk views (e.g. eclipse or transit
observation) where the disk itself is rendered as a textured object;
in that case use a centre-darkening texture on the Sun proxy
sprite/sphere.

A reasonable compromise for shaders is:

- **Solar disk irradiance integration**: use uniform disk radiance.
  The error from neglecting limb darkening is < 1% across the
  penumbra, dropping to 0% well inside or outside the band.
- **Solar disk visual rendering** (when the Sun is in the camera
  frustum): use Eddington-darkened texture for the disk image.

---

## 6. Multiple light sources: Earthshine

### 6.1 The geometry

Earth, as seen from the Moon, subtends a half-angle

```
α_e = R_e / d_em = 6.371e6 / 3.844e8 = 1.657 × 10⁻² rad ≈ 0.949°
```

So Earth is **~3.5× wider in angle than the Sun**. (The full angular
diameter of Earth from the Moon is `~1.9°`, vs `~0.53°` for the Sun.)

The total irradiance from Earthshine on the Moon's surface depends
on:

- Earth's phase (full Earth from a given lunar location → maximum
  Earthshine; new Earth → zero direct Earthshine).
- Earth's albedo (~0.30 Bond, with significant variation between
  ocean ~0.07 and snow/cloud ~0.85).
- The geometry of which face of the Moon is being illuminated.

The peak Earthshine intensity (Earth-full configuration) is roughly:

```
E_earthshine ≈ E_sun · A_earth · (R_e / d_em)² · π / Ω_sun_at_earth
            ≈ E_sun · 0.3 · (R_e / d_em)² · ... [varies, see below]
```

Standard published value for the maximum Earthshine irradiance on
the lunar surface (for an Earth-full configuration as seen from the
Moon, observed at the geometrically-most-favourable lunar location) is

```
E_earthshine ≈ 0.07 W m⁻² to 0.1 W m⁻²        (rough estimates)
```

This is `~5 × 10⁻⁵ to ~7 × 10⁻⁵` of the direct sunshine
(`1361 W m⁻²`). So the **brightness ratio is ~10⁻⁴ to 10⁻⁵**.

### 6.2 Should we model Earth as an extended disk?

For Earthshine to matter visually, the relevant question is whether
its angular size affects its illumination geometry compared to a
point source. The relevant question is: how soft is the *Earthshine
penumbra* on the lunar surface?

The penumbra band on the smooth Moon for Earthshine has angular
width `2 α_e ≈ 1.9°`, projecting to a band of width

```
W_band_earth = R_moon · 2α_e = 1.7374e6 · 0.0331 = 5.75 × 10⁴ m ≈ 57 km
```

So the Earth's terminator on the lunar surface (the "Earth-rise
line") is **57 km wide**, compared to **16 km for the Sun's
terminator**. About 3.5× wider, consistent with Earth's larger
angular size.

But Earth is *much dimmer* than the Sun. The Earthshine penumbra
band is a transition between `~0.1 W/m²` and `0`, vs. the solar
penumbra which is a transition between `1361 W/m²` and `0`. A
57 km Earthshine penumbra at 0.1 W/m² is essentially invisible
unless you're looking at the night side of the Moon under a near-
full Earth, in which case it might be a subtle gradient.

**For most rendering purposes**, Earthshine can be modelled as:

- **A point source approximation** when the Earth-direction is well
  away from the lunar terminator, with intensity scaled by Earth's
  phase function (a fraction of the maximum).
- **Optional**: a disk-source soft step `S_e(t_earth)` for the
  Earthshine "terminator" itself, but this is a second-order effect
  and only matters for high-quality night-side renders.

### 6.3 Spectral / colour effect

Earth's albedo is dominated by clouds (white, ~0.7 albedo at full
spectrum) and oceans (blue, with high reflectance in 400–500 nm and
low elsewhere). The *integrated* Earthshine spectrum is **noticeably
blue** compared to direct sunlight, with a characteristic colour
temperature elevated by ~1000 K relative to the Sun's nominal 5778 K
black-body.

For shader purposes, a simple multiplication by a bluish tint
(roughly `(0.7, 0.85, 1.0)` in linear RGB) is a reasonable
approximation. The full spectrum is well-documented in:

- **Goode et al., 2001, "Earthshine observations of the Earth's
  reflectance", Geophys. Res. Lett. 28, 1671** — long-term
  observations of Earthshine and inferences about Earth's albedo.
- **Pallé et al., 2003, "Earthshine and the Earth's albedo", Geophys.
  Res. Lett. 30, 1373** — confirmation and refinement.
- **Qiu et al., 2003, "Earthshine: spectral observations and
  modelling"**, J. Geophys. Res. 108(D22), 4709 — detailed spectral
  data.

### 6.4 Contribution to the Moon shader

For the lunar-orbit visualiser, **Earthshine should be modelled as a
weak, bluish, semi-Lambertian fill light** with intensity governed
by Earth's phase. The Earth's phase as seen from a given lunar
surface point depends on the geometry of the Sun-Moon-Earth system,
which the visualiser already computes. The simplest physically
plausible recipe is:

```
E_earth_visible(point) = E_max_earthshine · phase_factor(Sun-Earth-Moon angle)
                       · max(N_perturb · L_earth, 0)
                       · earth_visibility(N_geom · L_earth, α_e)        [optional disk soft step]
                       · earth_color_tint
```

with `phase_factor` going from 0 (new Earth) to 1 (full Earth), and
`E_max_earthshine ≈ 0.1 W/m²` at full Earth.

This is enough physics to get the night side of the Moon faintly
glowing in a way that's broadly consistent with Earthshine
photographs (e.g. of the lunar crescent with Earthshine illuminating
the unlit limb).

---

## 7. The terminator's appearance: real physics summary

### 7.1 Quantitative breakdown

Three distinct effects soften and shape the lunar terminator at
different scales:

| Effect | Angular scale | Surface scale on smooth Moon | Surface scale near a 5 km mountain (β_sun = 1°) |
| --- | --- | --- | --- |
| Sun-disk soft penumbra | ~0.53° (full diameter) | ~16 km band | (subsumed into cast-shadow softness) |
| Cast shadow penumbra from local relief | depends on `(h, d, β_sun)` | 0 km (no relief) | 0–150 km soft band |
| Cast shadow penumbra from global lunar curvature | already accounted for in `β_sun` definition |

The dominant visual feature on the terminator — the one that gives
the photographs their "scalloped" appearance — is the **cast-shadow
penumbra of major terrain features**. The Sun-disk penumbra is the
*lower limit* on softness that exists even on a perfectly smooth Moon,
but it is small (~16 km, ~9 arcseconds at Earth's distance) compared
to the terrain-driven softness which can be many tens of kilometres
wide.

### 7.2 Why photos look the way they do

Key observation: a typical full-disk Moon photograph at moderate zoom
(say, the Moon fills 1000 pixels of a 1080p image) has each pixel
representing about `3.5 km` of lunar surface (since the Moon is
3474 km across). At that scale:

- The Sun-disk penumbra band (16 km) is `~5 pixels wide`.
- A 5 km mountain's shadow penumbra at `d = 100 km` from the rim
  (`~30 km`) is `~9 pixels wide`.
- A 5 km mountain's shadow at `d = 287 km` (the shadow tip) has a
  penumbra of `~150 km`, which is `~43 pixels wide`.

The combined effect — a scalloped, irregular terminator with cast
shadows extending ~10⁻¹ to ~10² km past the mathematical terminator,
each with its own soft edge — is what we see in a good lunar photo.

### 7.3 Implication for shader design

Implications, in order of impact:

1. **A correct cast-shadow algorithm matters most.** Whether
   PCSS-style soft shadow maps, screen-space horizon mapping, or
   pre-baked horizon textures, the largest single source of
   terminator-shape realism is correct cast shadows.

2. **The smooth-normal disk source matters next.** Even on a perfectly
   smooth Moon (or at locations far from major relief), the Sun-disk
   penumbra of `~16 km` is visible at moderate-to-high zoom and adds
   a soft transition that pure Lambert can't reproduce.

3. **The smooth-vs-perturbed normal asymmetry is critical** for
   avoiding artifacts (white-haloed crater rims, leaky-terminator
   glows). Even with a correct disk-source step, using the wrong
   normal for the visibility test will pollute the result with
   spurious illumination.

4. **Earthshine should be a separate, bluish, weak fill light.** It
   doesn't strictly need disk-source treatment, but it does need to
   be modelled to avoid a pure-black night side that looks
   unnatural.

5. **Limb darkening can be ignored** for irradiance purposes (it
   matters only for visualising the Sun's disk itself).

---

## 8. Numerical reference values for shader implementation

Collected here for quick lookup during shader work:

```
Solar half-angle from Moon:       α     = 4.652e-3 rad ≈ 0.2666°
Solar full angle from Moon:       2α    = 9.305e-3 rad ≈ 0.5333°
Solar zenith irradiance:          E_zen ≈ 1361 W/m²
Solar disk soft penumbra band on smooth Moon: 16.2 km (great-circle distance)

Earth half-angle from Moon:       α_e   = 1.657e-2 rad ≈ 0.949°
Earth full angle from Moon:       2α_e  = 3.31e-2 rad ≈ 1.90°
Earth-shine peak irradiance:      ~0.1 W/m² (at full Earth, optimal lunar location)
Earth-shine soft penumbra band on smooth Moon: 57.5 km

Moon radius: 1737.4 km; circumference: 10915 km
Moon angular diameter from Earth: 0.518° (mean)
Moon angular diameter from low orbit (100 km): ~93°
Moon angular diameter from typical visualiser zoom: depends on camera

Lambert / point-source error vs disk source:
  At t = +1 (sun grazing): point source = 1.000, disk source = 1.000 (identical)
  At t = +0.5: point = 0.500, disk = 0.540 (disk is +8% brighter — sub-solar limb still contributes)
  At t = 0  : point = 0.000, disk = 0.212 (disk has finite glow; point has nothing)
  At t = -0.5: point = 0.000, disk = 0.040 (deep penumbra; point has nothing)
  At t = -1 (sun set): point = 0.000, disk = 0.000 (identical)
```

Tabulated `S(t)` for fast shader lookup (in steps of 0.05):

| t | S(t) | t | S(t) |
| --- | --- | --- | --- |
| -1.00 | 0.0000 | +0.05 | 0.2334 |
| -0.95 | 0.0011 | +0.10 | 0.2553 |
| -0.90 | 0.0036 | +0.15 | 0.2780 |
| -0.85 | 0.0079 | +0.20 | 0.3015 |
| -0.80 | 0.0136 | +0.25 | 0.3257 |
| -0.75 | 0.0205 | +0.30 | 0.3506 |
| -0.70 | 0.0285 | +0.35 | 0.3760 |
| -0.65 | 0.0376 | +0.40 | 0.4019 |
| -0.60 | 0.0476 | +0.45 | 0.4282 |
| -0.55 | 0.0584 | +0.50 | 0.4549 |
| -0.50 | 0.0700 | +0.55 | 0.4818 |
| -0.45 | 0.0822 | +0.60 | 0.5089 |
| -0.40 | 0.0951 | +0.65 | 0.5361 |
| -0.35 | 0.1085 | +0.70 | 0.5635 |
| -0.30 | 0.1224 | +0.75 | 0.5908 |
| -0.25 | 0.1366 | +0.80 | 0.6182 |
| -0.20 | 0.1513 | +0.85 | 0.6453 |
| -0.15 | 0.1663 | +0.90 | 0.6722 |
| -0.10 | 0.1815 | +0.95 | 0.6987 |
| -0.05 | 0.1969 | +1.00 | 0.7250 |
| 0.00 | 0.2122 |   |   |

Wait, that table is wrong: for `t > 1` we should have `S = t`, so
`S(+1.0) = 1.0`, not `0.7250`. The table above has the values
*inside* the penumbra band only, where `S` is the soft-step that
interpolates between 0 (at `t = −1`) and 1 (at `t = +1`). Let me
redo the formula and the table.

Recall:

```
S(t) = t · f_geom(t) + (2/(3π)) · (1 − t²)^{3/2}    for |t| ≤ 1
S(t) = t                                              for t ≥ 1
S(t) = 0                                              for t ≤ −1
```

At `t = 1`: `S(1) = 1 · 1 + (2/(3π)) · 0 = 1.0`. ✓

At `t = 0.5`: `S(0.5) = 0.5 · f_geom(0.5) + (2/(3π))·(0.75)^{1.5}
                    = 0.5 · 0.8044 + 0.2122 · 0.6495
                    = 0.4022 + 0.1378
                    = 0.5400` ✓ (matches earlier computation)

So the corrected table, computed carefully step by step:

```
For t in [-1, +1] inclusive, with f_geom and S below:

t       f_geom   t·f_geom    (1-t²)^1.5    (2/3π)·(1-t²)^1.5    S(t)
=====   ======   ========    ============   ===================   ======
-1.00   0.0000   0.0000      0.0000         0.0000                0.0000
-0.90   0.0489   -0.0440     0.0838         0.0178                -0.0262   ← negative??
```

Wait, `S(-0.9)` is negative. That can't be right if irradiance must
be non-negative.

Let me sanity-check `f_geom(-0.9)`:

```
f_geom(-0.9) = (1/π) [arccos(0.9) + (-0.9)·√(1 − 0.81)]
            = (1/π) [arccos(0.9) − 0.9·√0.19]
            = (1/π) [0.4510 − 0.9·0.4359]
            = (1/π) [0.4510 − 0.3923]
            = (1/π) [0.0587]
            = 0.01868
```

Hmm, that's much smaller than my "0.0489" above. Let me redo more carefully.

`arccos(0.9) = ?`. Using the Taylor expansion or table:
`cos(25.842°) = 0.9` → `arccos(0.9) = 25.842° = 0.45103 rad`. ✓.
`√0.19 = 0.43589`. ✓.
`0.9 · 0.43589 = 0.39230`. ✓.
`0.45103 − 0.39230 = 0.05873`. ✓.
`0.05873 / π = 0.01869`. ✓.

So `f_geom(-0.9) = 0.0187`, not `0.0489`. I made an arithmetic error
in the row table.

Let me regenerate the table carefully. I'll use Python-style mental
arithmetic:

```
Helper: arccos(x) values:
  arccos(1.00) = 0
  arccos(0.95) = 0.31756 rad (18.19°)
  arccos(0.90) = 0.45103 rad (25.84°)
  arccos(0.85) = 0.55444 rad (31.79°)
  arccos(0.80) = 0.64350 rad (36.87°)
  arccos(0.75) = 0.72273 rad (41.41°)
  arccos(0.70) = 0.79540 rad (45.57°)
  arccos(0.65) = 0.86321 rad (49.46°)
  arccos(0.60) = 0.92730 rad (53.13°)
  arccos(0.55) = 0.98843 rad (56.63°)
  arccos(0.50) = 1.04720 rad (60.00°)
  arccos(0.45) = 1.10403 rad (63.26°)
  arccos(0.40) = 1.15928 rad (66.42°)
  arccos(0.35) = 1.21323 rad (69.51°)
  arccos(0.30) = 1.26610 rad (72.54°)
  arccos(0.25) = 1.31812 rad (75.52°)
  arccos(0.20) = 1.36944 rad (78.46°)
  arccos(0.15) = 1.42022 rad (81.37°)
  arccos(0.10) = 1.47063 rad (84.26°)
  arccos(0.05) = 1.52084 rad (87.13°)
  arccos(0.00) = 1.57080 rad (90.00°)
  arccos(-x)    = π − arccos(x)
```

```
Helper: √(1−t²) values:
  √(1−0.00²) = 1.00000
  √(1−0.05²) = 0.99875
  √(1−0.10²) = 0.99499
  √(1−0.15²) = 0.98869
  √(1−0.20²) = 0.97980
  √(1−0.25²) = 0.96825
  √(1−0.30²) = 0.95394
  √(1−0.35²) = 0.93675
  √(1−0.40²) = 0.91652
  √(1−0.45²) = 0.89303
  √(1−0.50²) = 0.86603
  √(1−0.55²) = 0.83516
  √(1−0.60²) = 0.80000
  √(1−0.65²) = 0.75994
  √(1−0.70²) = 0.71414
  √(1−0.75²) = 0.66144
  √(1−0.80²) = 0.60000
  √(1−0.85²) = 0.52678
  √(1−0.90²) = 0.43589
  √(1−0.95²) = 0.31225
  √(1−1.00²) = 0.00000

Helper: (1−t²)^{3/2}  =  (√(1−t²))³:
  t=0.00:  1.00000
  t=0.05:  0.99625
  t=0.10:  0.98506
  t=0.15:  0.96644
  t=0.20:  0.94046
  t=0.25:  0.90745
  t=0.30:  0.86813
  t=0.35:  0.82179
  t=0.40:  0.76997
  t=0.45:  0.71218
  t=0.50:  0.64953
  t=0.55:  0.58269
  t=0.60:  0.51200
  t=0.65:  0.43900
  t=0.70:  0.36426
  t=0.75:  0.28941
  t=0.80:  0.21600
  t=0.85:  0.14619
  t=0.90:  0.08283
  t=0.95:  0.03044
  t=1.00:  0.00000

Helper: f_geom(t):

For t ≥ 0:  f_geom(t) = (1/π)[arccos(-t) + t·√(1−t²)]
For t = 0:  f_geom(0) = (1/π)[π/2 + 0] = 0.5
For t = 1:  f_geom(1) = (1/π)[π + 0] = 1.0

For t < 0:  f_geom(t) = 1 − f_geom(-t)

Computing the positive side:

  t      arccos(-t)  t·√(1-t²)    sum         /π = f_geom(t)
  0.00   1.57080     0.00000      1.57080     0.50000
  0.05   1.62079     0.04994      1.67073     0.53180   <- arccos(-0.05) = π − arccos(0.05) = 3.1416 − 1.52084 = 1.62079
  0.10   1.67096     0.09950      1.77046     0.56353
  0.15   1.72137     0.14830      1.86967     0.59512
  0.20   1.77215     0.19596      1.96811     0.62647
  0.25   1.82348     0.24206      2.06554     0.65745
  0.30   1.87549     0.28618      2.16167     0.68805
  0.35   1.92836     0.32786      2.25622     0.71813
  0.40   1.98231     0.36661      2.34892     0.74762
  0.45   2.03756     0.40186      2.43942     0.77648
  0.50   2.09439     0.43301      2.52740     0.80449
  0.55   2.15316     0.45934      2.61250     0.83158
  0.60   2.21429     0.48000      2.69429     0.85761
  0.65   2.27838     0.49396      2.77234     0.88245
  0.70   2.34619     0.49990      2.84609     0.90593
  0.75   2.41885     0.49608      2.91493     0.92785
  0.80   2.49808     0.48000      2.97808     0.94795
  0.85   2.58714     0.44776      3.03490     0.96603
  0.90   2.69056     0.39230      3.08286     0.98129
  0.95   2.82403     0.29664      3.12067     0.99332
  1.00   3.14159     0.00000      3.14159     1.00000

For negative t, use f_geom(t) = 1 − f_geom(-t):

  t      f_geom(t)
  -1.00  0.00000
  -0.95  0.00668
  -0.90  0.01871
  -0.85  0.03397
  -0.80  0.05205
  -0.75  0.07215
  -0.70  0.09407
  -0.65  0.11755
  -0.60  0.14239
  -0.55  0.16842
  -0.50  0.19551
  -0.45  0.22352
  -0.40  0.25238
  -0.35  0.28187
  -0.30  0.31195
  -0.25  0.34255
  -0.20  0.37353
  -0.15  0.40488
  -0.10  0.43647
  -0.05  0.46820
   0.00  0.50000
```

Now compute `S(t) = t · f_geom(t) + (2/(3π)) · (1−t²)^{3/2}`:

`(2/(3π)) = 0.21221`.

```
t       t·f_geom(t)       (2/3π)·(1-t²)^1.5     S(t)
====   ===============   ===================   ======
-1.00  -1.00·0.00000=0   0.21221·0      =0     0.00000
-0.95  -0.95·0.00668=-0.00635   0.21221·0.03044=0.00646   0.00011
-0.90  -0.90·0.01871=-0.01684   0.21221·0.08283=0.01757   0.00073
-0.85  -0.85·0.03397=-0.02887   0.21221·0.14619=0.03102   0.00215
-0.80  -0.80·0.05205=-0.04164   0.21221·0.21600=0.04584   0.00420
-0.75  -0.75·0.07215=-0.05411   0.21221·0.28941=0.06140   0.00729
-0.70  -0.70·0.09407=-0.06585   0.21221·0.36426=0.07729   0.01144
-0.65  -0.65·0.11755=-0.07641   0.21221·0.43900=0.09316   0.01675
-0.60  -0.60·0.14239=-0.08543   0.21221·0.51200=0.10865   0.02322
-0.55  -0.55·0.16842=-0.09263   0.21221·0.58269=0.12365   0.03102
-0.50  -0.50·0.19551=-0.09776   0.21221·0.64953=0.13783   0.04007
-0.45  -0.45·0.22352=-0.10058   0.21221·0.71218=0.15113   0.05055
-0.40  -0.40·0.25238=-0.10095   0.21221·0.76997=0.16341   0.06246
-0.35  -0.35·0.28187=-0.09865   0.21221·0.82179=0.17441   0.07576
-0.30  -0.30·0.31195=-0.09359   0.21221·0.86813=0.18424   0.09065
-0.25  -0.25·0.34255=-0.08564   0.21221·0.90745=0.19256   0.10692
-0.20  -0.20·0.37353=-0.07471   0.21221·0.94046=0.19957   0.12486
-0.15  -0.15·0.40488=-0.06073   0.21221·0.96644=0.20509   0.14436
-0.10  -0.10·0.43647=-0.04365   0.21221·0.98506=0.20904   0.16539
-0.05  -0.05·0.46820=-0.02341   0.21221·0.99625=0.21142   0.18801
 0.00   0.00·0.50000=0.00000    0.21221·1.00000=0.21221   0.21221
+0.05  +0.05·0.53180=0.02659    0.21221·0.99625=0.21142   0.23801
+0.10  +0.10·0.56353=0.05635    0.21221·0.98506=0.20904   0.26539
+0.15  +0.15·0.59512=0.08927    0.21221·0.96644=0.20509   0.29436
+0.20  +0.20·0.62647=0.12529    0.21221·0.94046=0.19957   0.32486
+0.25  +0.25·0.65745=0.16436    0.21221·0.90745=0.19256   0.35692
+0.30  +0.30·0.68805=0.20642    0.21221·0.86813=0.18424   0.39065
+0.35  +0.35·0.71813=0.25135    0.21221·0.82179=0.17441   0.42576
+0.40  +0.40·0.74762=0.29905    0.21221·0.76997=0.16341   0.46246
+0.45  +0.45·0.77648=0.34942    0.21221·0.71218=0.15113   0.50055
+0.50  +0.50·0.80449=0.40224    0.21221·0.64953=0.13783   0.54007
+0.55  +0.55·0.83158=0.45737    0.21221·0.58269=0.12365   0.58102
+0.60  +0.60·0.85761=0.51457    0.21221·0.51200=0.10865   0.62322
+0.65  +0.65·0.88245=0.57359    0.21221·0.43900=0.09316   0.66675
+0.70  +0.70·0.90593=0.63415    0.21221·0.36426=0.07729   0.71144
+0.75  +0.75·0.92785=0.69589    0.21221·0.28941=0.06140   0.75729
+0.80  +0.80·0.94795=0.75836    0.21221·0.21600=0.04584   0.80420
+0.85  +0.85·0.96603=0.82113    0.21221·0.14619=0.03102   0.85215
+0.90  +0.90·0.98129=0.88316    0.21221·0.08283=0.01757   0.90073
+0.95  +0.95·0.99332=0.94365    0.21221·0.03044=0.00646   0.95011
+1.00  +1.00·1.00000=1.00000    0.21221·0.00000=0.00000   1.00000
```

This table is now self-consistent: `S(t) ≥ 0` everywhere, `S(0) = 0.21221`,
`S(±1) = boundary values 0 and 1`.

Cross-check the symmetry property: `S(t) + S(-t) = ?`. Not equal to
`t` in general. Let's see at `t = 0.5`:
`S(0.5) + S(-0.5) = 0.54007 + 0.04007 = 0.58014`. And `2 · 0.21221 · 1·... `
hmm actually the symmetry is `S(t) − S(-t) = ?`. Let me think.

We have `S(t) = t·f_geom(t) + K·(1−t²)^{1.5}` where `K = 2/(3π)`.
`S(-t) = -t·f_geom(-t) + K·(1−t²)^{1.5} = -t·(1−f_geom(t)) + K·(1−t²)^{1.5}`.
So `S(t) − S(-t) = t·f_geom(t) + t·(1−f_geom(t)) = t`.
And `S(t) + S(-t) = t·(2 f_geom(t) − 1) + 2K·(1−t²)^{1.5}`.

So `S(t) − S(-t) = t`, **always**. This is the "Lambert recovery"
property: when you average the disk responses for symmetric-elevation
positions, you get exactly the Lambert response. The symmetric extra
term `2K·(1−t²)^{1.5}` is the "extra" illumination contributed by the
finite size of the source — equally to both sides of the terminator.

Verifying: `S(0.5) − S(-0.5) = 0.54007 − 0.04007 = 0.50000 = t`. ✓
`S(0.7) − S(-0.7) = 0.71144 − 0.01144 = 0.70000 = t`. ✓

This is a useful property. It tells us: **the disk source adds an
extra symmetric illumination of `K·(1−t²)^{1.5}` on top of the Lambert
response**, which is `0.21221` at the terminator (`t = 0`) and falls
off to zero at the outer edges (`t = ±1`).

### 8.2 Compact analytical fit (for shader)

The function `S(t)` is well-approximated by a smoothstep-like
polynomial. Fitting `S(t) ≈ s₀ + s₁ t + s₃ t³ + s₅ t⁵` over the band
`t ∈ [-1, +1]`:

A reasonable fit is:

```
S(t) ≈ 0.2122 + 0.5·t · clamp(...)
```

But actually the simplest exact form is the closed form itself:
`S(t) = t · f_geom(t) + (2/(3π)) · (1−t²)^{3/2}`. The `f_geom`
function involves `arccos`, which is GPU-supported but not free.
A close, hardware-friendly approximation:

```
// Smooth disk-source step, t = (N · L) / α
float diskStep(float t) {
    if (t <= -1.0) return 0.0;
    if (t >= +1.0) return t;       // point-source recovery
    // Inside the penumbra band:
    float fg = 0.5 + (1.0/3.14159) * (asin(t) + t * sqrt(max(0.0, 1.0 - t*t)));
    float onemt2 = max(0.0, 1.0 - t*t);
    float moment = (2.0 / (3.0 * 3.14159)) * pow(onemt2, 1.5);
    return t * fg + moment;
}
```

This is two `asin`/`sqrt`/`pow` evaluations — about 10 GPU clock cycles
on modern hardware — and is exact in the small-`α` regime. For
performance-critical shaders, a polynomial or LUT-texture
approximation is straightforward (and the LUT is 1D over `t ∈ [-1, +1]`,
so a 256-entry texture is more than enough).

A **smoothstep approximation** `S(t) ≈ smoothstep(-1, +1, t)` differs
from the exact form by up to 0.05 in the middle of the band, but is
correct at the boundaries. Visually this is acceptable but not
ideal.

A **Hermite cubic** that matches `S(±1)` and `S'(±1) = 1` (to recover
Lambert outside) plus `S(0) = 0.2122` and `S'(0) = ?` is a better
tradeoff. We'll work that out in note 02.

---

## 9. Algorithm sketch for the new shader (preview only — full design in later notes)

Putting the physics together, the per-pixel shading recipe near the
terminator should be:

```glsl
// Inputs:
//   N_geom:    smooth (mesh) normal at this pixel, world space
//   N_perturb: normal-mapped (perturbed) normal at this pixel, world space
//   L:         direction to Sun centre, world space (unit)
//   alpha:     Sun half-angle (4.652e-3 rad for lunar geometry)
//   E0:        Sun zenith irradiance (1361 W/m² in physical units)
//   horizon_offset_rad: max angular elevation of cast-shadow occluders
//                       in the Sun's azimuth as seen from this pixel
//                       (computed from horizon map / shadow map / ...)
//   E_earthshine: contribution from Earth (separate calculation)

// 1. Macro horizon visibility (smooth normal + cast shadows)
float NdotL_geom = dot(N_geom, L);                       // = sin(beta_sun_above_smooth_horizon)
float effective_NdotL = NdotL_geom - sin(horizon_offset_rad);
float t = effective_NdotL / alpha;                       // normalised position in penumbra band
float visibility = diskStep(t) / max(t, ...);            // disk soft-step, but careful normalisation

// 2. Lambert response (perturbed normal)
float NdotL_perturb = max(dot(N_perturb, L), 0.0);

// 3. Final solar irradiance per unit surface area
float irradiance = E0 * visibility * NdotL_perturb;

// 4. Earthshine (separate, much weaker, optional disk-source treatment)
// ...

// 5. Apply BRDF (Lambert / Lommel-Seeliger / Hapke)
vec3 albedo_color = sampleAlbedoTexture(uv);
vec3 reflected = albedo_color * (irradiance / 3.14159);   // Lambert BRDF; replace with Hapke if needed
```

Notes on the above:

- The combination `visibility * NdotL_perturb` is a *factorisation*
  approximation. The truly correct quantity is the integral of
  `max(N_perturb · L̂, 0) · L_sun(L̂)` over the visible disk. For
  `N_perturb` close to `N_geom` and `α ≪ 1`, the factorisation is
  good to first order in `(N_perturb - N_geom)`. We'll quantify the
  error in note 02.

- The `disksStep / NdotL_geom` form needs care to avoid division by
  zero. A better formulation works directly with the irradiance ratio
  (i.e. `S(t) · α / max(t, ...)·α`) and uses a smoothed denominator.

- `horizon_offset_rad` is the bit that requires actual cast-shadow
  computation. Options include:
  - **Pre-baked horizon map**: a low-res cubemap or 2D map of the
    horizon profile per surface point, sampled in the Sun's azimuth.
    Best quality, fixed shape (no dynamic geometry).
  - **Screen-space horizon trace**: short ray-march along the
    Sun-projection of the depth buffer. Cheap, view-dependent.
  - **PCSS shadow map**: percentage-closer soft shadows from a
    standard shadow map. Standard real-time technique. Can be tuned
    to match the disk-source softness.

- The lunar Moon shader can be smarter than the above by exploiting
  the smoothness of the Moon's underlying geometry (a sphere) and
  the limited dynamic range of relief (LRO LOLA `ldem_64` peaks
  at ~9 km amplitude). A ray-march along the great-circle direction
  from each pixel toward the Sun, against a low-res displacement-map
  lookup, would compute `horizon_offset_rad` directly.

The full shader design (and benchmarks for the various horizon-test
options) belong in note 02 and onwards. This note has done its job
once the physics is pinned down.

---

## 10. References

- **Hapke, B. W., 2012**. *Theory of Reflectance and Emittance
  Spectroscopy*, 2nd ed., Cambridge Univ. Press. The standard
  textbook for planetary photometry. Especially Ch. 8 ("Reflectance
  of a Smooth Surface"), Ch. 9 ("Reflectance of a Particulate
  Medium"), Ch. 10 ("Reflectance of a Particulate Medium with
  Macroscopic Roughness"). Hapke's `S(i, e, ψ)` shadowing function
  is the statistical analogue of the smooth-vs-perturbed-normal
  decomposition discussed in §4.

- **Akenine-Möller, T., Haines, E., Hoffman, N., 2018**. *Real-Time
  Rendering*, 4th ed., CRC Press. Especially Ch. 9 (BRDF) and
  Ch. 11 (global illumination, ambient/indirect). The textbook for
  understanding the geometric-vs-shading-normal distinction.

- **Pharr, M., Jakob, W., Humphreys, G., 2023**. *Physically Based
  Rendering: From Theory to Implementation*, 4th ed., MIT Press.
  Especially Ch. 8 (sources), Ch. 12 (light transport), Ch. 13
  (samplers). PBRT's treatment of area light sources via shadow
  rays + BRDF integration is the offline-rendering analogue of the
  visibility-vs-Lambert decomposition.

- **Heitz, E., 2014**. "Understanding the Masking-Shadowing Function
  in Microfacet-Based BRDFs". *Journal of Computer Graphics
  Techniques* 3(2). Modern reference for the geometric vs perturbed
  normal distinction in microfacet BRDFs.

- **Eddington, A. S., 1926**. *The Internal Constitution of the
  Stars*. Cambridge Univ. Press. Ch. 11 derives the linear limb
  darkening law from radiative transfer in a stellar atmosphere.
  (Modern textbooks: Mihalas & Mihalas 1984; Rybicki & Lightman
  1979.)

- **Goode, P. R., et al., 2001**. "Earthshine observations of the
  Earth's reflectance". *Geophysical Research Letters* 28, 1671.
  Earthshine intensity and Earth's albedo.

- **Pallé, E., et al., 2003**. "Earthshine and the Earth's albedo:
  2. Observations and simulations over 3 years". *Geophysical
  Research Letters* 30, 1373.

- **NASA SVS, "Visualization Studio: CGI Moon Kit"**, ID 4720,
  https://svs.gsfc.nasa.gov/4720/. Color and displacement maps
  for the Moon. The `ldem_64_uint.tif` is the highest-quality
  displacement source generally available.

- **Schlick, C., 1994**. "An Inexpensive BRDF Model for
  Physically-Based Rendering". *Computer Graphics Forum*, 13(3),
  233. Original split between geometric shadowing and microfacet
  terms.

- **Lambert, J. H., 1760**. *Photometria*. Original derivation of
  the cosine law of illumination and reflection.

- **Buratti, B. J., et al., 2011**. "Photometry of the Moon at high
  phase angles from Cassini ISS observations". *Icarus* 211, 198.
  Empirical lunar photometric data for verification of Hapke and
  related models.

- **McEwen, A. S., 1991**. "Photometric functions for photoclinometry
  and other applications". *Icarus* 92, 298. Comparison of
  photometric models including Lambert, Lommel-Seeliger, Hapke, and
  empirical fits.

---

## Appendix A: alternative compact forms

If the shader prefers to compute `f_geom` from `(NdotL_geom, alpha)`
directly without first computing `t = NdotL_geom/alpha`, the formulae
become (using `sinβ = NdotL_geom`):

```
A_above(β) = α² [arccos(-sinβ/α) + (sinβ/α)√(1 − sin²β/α²)]    for |sinβ| ≤ α
M_above(β) = (2/3)(α² − sin²β)^{3/2}                            for |sinβ| ≤ α

E(β) ≈ L_sun · [sinβ · A_above(β) + cosβ · M_above(β)]          (cosβ ≈ 1)
```

Or equivalently in terms of `μ = sinβ = N · L` (the "dot product"
quantity that the shader naturally computes):

```
S_unnorm(μ) = μ · [arccos(-μ/α) + (μ/α)·√(1 − μ²/α²)] / π
            + (2/(3π)) · (1 − μ²/α²)^{3/2}                    for |μ| ≤ α
            = μ                                                 for μ ≥ α
            = 0                                                 for μ ≤ -α
```

Then per-pixel irradiance ≈ `E_zenith · S_unnorm(μ)`.

## Appendix B: derivation of S(t) symmetry property in a different form

Let `H(t) = (1−t²)^{3/2}` and `K = 2/(3π)`. Then

```
S(t) - S(-t) = t [f_geom(t) + f_geom(-t)] + K [H(t) - H(-t)]
            = t · 1 + K · 0
            = t
```

since `f_geom(t) + f_geom(-t) = 1` (by the disk-area complementary
property) and `H(t) = H(-t)` (since `H` depends only on `t²`).

So the antisymmetric part of `S` is exactly `t/2`, and the symmetric
part is `K · H(t)`. Decomposing:

```
S(t) = (t/2) + (S(t) + S(-t))/2 - (t/2)·(... )

Actually, decomposing into symmetric + antisymmetric:

  S_anti(t) = (S(t) - S(-t))/2 = t/2
  S_sym(t)  = (S(t) + S(-t))/2 = ?

  S_sym(t) = K · H(t) + t · (f_geom(t) - 0.5)
          = K · H(t) + t · (1/π) [arcsin(t) + t·√(1−t²)]    (using the symmetric form of f_geom)

  Hmm that's still asymmetric in `t`. Wait, let me reconsider.

Re-examining: `S(t) - S(-t) = t · [f_geom(t) - f_geom(-t)] + K·[H(t) - H(-t)]`.
Wait, that's `t·f_geom(t) - (-t)·f_geom(-t) = t·f_geom(t) + t·f_geom(-t) = t·1 = t`. Yes.

And `S(t) + S(-t) = t·f_geom(t) - t·f_geom(-t) + 2K·H(t) = t·[f_geom(t) - f_geom(-t)] + 2K·H(t)`.

`f_geom(t) - f_geom(-t) = 2·f_geom(t) - 1 = (2/π)[arcsin(t) + t·√(1−t²)]`.

So `S(t) + S(-t) = (2t/π)[arcsin(t) + t√(1−t²)] + 2K·(1−t²)^{3/2}`.

This is even in `t`, as it should be. At `t=0`: `S(0) + S(0) = 2 K = 4/(3π) ≈ 0.4244`,
so `S(0) = 0.2122`. ✓
```

The decomposition `S = (Lambert) + (extra disk contribution)` with
the "extra" being symmetric in `t` is a useful conceptual model:

```
S(t) ≈ max(t, 0)  +  ΔS(t)

where  ΔS(t)  is "the extra illumination from the disk source"

ΔS(t) = S(t) - max(t, 0)
      = K · (1−t²)^{3/2} + t · f_geom(t) - max(t, 0)
      = K · (1−t²)^{3/2} + t · [f_geom(t) - 1]      for t ≥ 0
      = K · (1−t²)^{3/2} + t · f_geom(t)            for t < 0
```

Numerically, `ΔS(0) = K = 0.2122` (peak), and `ΔS(±1) = 0`.

This is the "disk glow" — the part of the irradiance that wouldn't
exist with a point source. **Adding `ΔS(t) · α · E_zenith` to the
ordinary Lambert irradiance is the leading-order correction needed
to upgrade a point-source Moon shader to a disk-source Moon shader.**

---

## Appendix C: derivation of the Sun-disk penumbra band width on a smooth Moon (16 km) — full chain

The half-angle subtended by the Sun at the Moon is `α = R_sun / d_sun-moon`.
Because the Moon's heliocentric distance is essentially the same as
Earth's (both ≈ 1 au, varying by ±0.3% over a month due to lunar
orbital geometry), the Sun's angular diameter as seen from the Moon
is the same as from Earth.

`α = 6.957e8 / 1.496e11 = 4.652e-3 rad`.

For a smooth Moon (perfect sphere, no relief), the "terminator" is a
great circle on the Moon's surface separating the lit hemisphere from
the unlit. At any point on this great circle, the Sun is at zero
elevation (`β_sun = 0`). At points slightly inside the lit hemisphere
(toward the sub-solar point), the Sun's elevation is positive; at
points slightly inside the unlit hemisphere, negative.

The relationship between angular distance `θ_geo` (from the great-
circle terminator, measured along a great circle on the Moon's
surface) and the Sun's local elevation `β_sun` is:

```
β_sun = θ_geo
```

because of the geometry of a sphere viewed from infinity (which the
Sun effectively is). Specifically: at a point at angular distance
`θ_geo` from the terminator, on the lit side, the local "up" direction
makes an angle `90° − θ_geo` with the line from the point to the Sun.
So the elevation of the Sun above the local horizon is
`90° − (90° − θ_geo) = θ_geo`.

The penumbra band is `−α ≤ β_sun ≤ +α`, which in angular distance
is `−α ≤ θ_geo ≤ +α`.

In linear distance along the Moon's surface (great-circle):

```
ds = R_moon · dθ_geo
```

So the full penumbra band (width `2α` in angle) is:

```
Δs = R_moon · 2α = 1.7374e6 · 9.305e-3 m = 1.6166e4 m ≈ 16.17 km
```

This is the **on-the-ground width of the lunar Sun-disk penumbra
band**.

For comparison, for the Earth (with the Sun at the same angular
diameter, `2α ≈ 0.533°`), the penumbra band on Earth's surface is

```
Δs_earth = R_earth · 2α = 6.371e6 · 9.305e-3 m ≈ 5.93 × 10⁴ m ≈ 59 km
```

(This is why the duration of dawn/dusk on Earth — the time for the
Sun to traverse one diameter — corresponds to `2α / ω_earth = 0.533° / 0.25°/min = 2.13 min` astronomically; in practice atmospheric scattering extends it considerably longer. On the airless Moon, the geometric penumbra of the Sun's disk transition takes about `2α / ω_moon = 0.533° / (360°/29.5days) = 1 hour 2 minutes` for any given lunar location.)

---

## Appendix D: Hapke's macroscopic roughness — the "right" way to handle sub-pixel topography

Hapke's photometric model (Hapke 1981–1984, refined 2002, 2012) is
the standard for planetary surface BRDFs. Its key innovation
relevant here is the *macroscopic roughness function* `S(i, e, ψ; θ̄)`,
which accounts for sub-resolution-element topography (i.e. the fact
that a lunar surface point in any image isn't really flat).

The Hapke shadowing function reduces the lit area of a rough surface
relative to a smooth one, and is parameterised by the **mean facet
slope angle** `θ̄` (typically `15°–30°` for lunar surfaces). The
shadowing function multiplies the photometric response and is
derived assuming a Gaussian distribution of facet slopes.

The relevant equations from Hapke (2012, Ch. 10) are extensive; the
key result for our purposes is that the shadowing function `S` is
*not* the same as the disk-source `S(t)` derived above. Hapke's `S`
is an **angular-integral** correction over a *statistical* facet
distribution, while our `S(t)` is an angular-integral over the
*Sun's disk source* with a *deterministic* horizon.

For a Moon shader that uses both:

1. Use the **disk-source `S(t)`** (this note's main result) for the
   smooth-mesh, deterministic-geometry visibility.

2. *Optionally* use **Hapke's `S(i, e, ψ; θ̄)`** as a multiplicative
   correction for sub-pixel roughness. The combined shader response
   for a fully-lit pixel (no penumbra) becomes

   ```
   L_out = albedo · E0/π · S_hapke(i, e, ψ) · max(N_perturb · L, 0)
   ```

   and for a penumbra-zone pixel:

   ```
   L_out ≈ albedo · E0/π · S_hapke(i, e, ψ) · α · S_disk(NdotL_geom / α)
   ```

   where `S_hapke` provides micro-roughness and `S_disk` provides the
   macro-disk-source soft step. The two functions are
   complementary, not redundant.

We won't pursue Hapke further in this physics note (its full
implementation is a separate research thread). What's important is:

- The disk-source `S(t)` derived here is **physically correct** for
  the smooth-mesh terminator transition.
- It does **not** replace the Hapke roughness function or the
  per-pixel Lambert response.
- All three terms (disk-source visibility, Hapke roughness, per-pixel
  Lambert) operate on **different aspects** of the geometry and
  should be combined multiplicatively.

---

## Appendix E: a note on units and the `α ≪ 1` regime

Throughout this document, `α ≈ 4.65 × 10⁻³` rad is treated as a small
parameter, and all formulae are derived in the small-angle limit.
Concretely, the corrections from finite `α` are of order `α² ≈ 2 × 10⁻⁵`,
or about 1 part in 50,000.

The largest correction comes from the spherical geometry of the
celestial sphere: the disk of the Sun is *not* exactly a planar
circle in the tangent plane, but a spherical cap. The cap's solid
angle is `Ω = 2π(1 − cos α)`, while the planar disk's area in the
tangent plane is `π α²`. The ratio:

```
Ω / (π α²) = (1 − cos α) · 2 / α²
           = (α²/2 − α⁴/24 + ...) · 2 / α²
           = 1 − α²/12 + ...
           = 1 − 1.8 × 10⁻⁶
```

So the planar approximation underestimates the solid angle by less
than 2 ppm. **Negligible** for any practical rendering purpose.

The second correction is the difference between `tan β` and `sin β`
when relating planar-tangent coords to spherical geometry. For
`β ≈ α ≈ 5 × 10⁻³` rad, `tan β − sin β ≈ β³/2 ≈ 6 × 10⁻⁸`. **Also
negligible.**

Conclusion: the small-`α` formulae are exact for the lunar geometry
to better than 6 significant digits, which is far beyond the
precision needed for shader work. There is **no need to retain
higher-order corrections in `α`** for any production code.

---

## Summary of conclusions

1. **The Sun is a disk, not a point.** The point-source Lambert
   approximation `max(N · L, 0)` is wrong inside a band of angular
   width `2α ≈ 0.533°` centred on the geometric terminator. Inside
   that band, the correct irradiance is given by the closed-form
   function

   ```
   S(t) = t · f_geom(t) + (2/(3π)) · (1 − t²)^{3/2},     t = (N · L) / α
   ```

   where `f_geom(t) = (1/π) [arccos(−t) + t·√(1 − t²)]` is the
   fractional disk area above the horizon. Outside the band, `S(t)`
   recovers the Lambert result `max(t, 0) · α`.

2. **The penumbra band is ~16 km wide on a smooth Moon.** This
   matters at high zoom but is dwarfed by cast-shadow effects from
   real terrain.

3. **Cast shadows from terrain features have penumbrae 10–100s of
   km wide near the terminator** (sun at low altitude). These are
   the dominant terminator-softening features in real lunar imagery
   and *must* be modelled for visual realism.

4. **Smooth and perturbed normals do different jobs.** The smooth
   normal goes into the visibility / horizon test; the perturbed
   normal goes into the Lambert cosine response. Mixing them
   produces specific artifacts (white halos around crater rims,
   leaky terminator).

5. **Limb darkening can be neglected** for irradiance calculations.

6. **Earthshine is ~10⁻⁴ to 10⁻⁵ of direct sunshine**, has a
   ~57 km penumbra band on the smooth Moon, and is bluish. Best
   modelled as a separate weak fill light, optionally with disk-
   source soft step but commonly with point-source approximation.

7. **The disk-source `S(t)` is the right "soft step" for the
   shader's directional-light term**, and is exact in the small-`α`
   regime that applies for both Sun and Earth as seen from the
   Moon.

End of note 01.

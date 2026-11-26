# Graphics trial log

The owner wants to "push the graphics just a bit" and chooses from pictures. Four looks, each with its own switch,
on the solo island first (core/gfx.js: the switches and the post-processing chain; solo/gfxlook.js: the island's
side). Nothing changes for anyone until a look is switched on: `DEFAULT_LOOK` in core/gfx.js is all off.

## Switches

- Address (the trial, never saved): `?gfx=glow,life,light,mini` (any of them), `?gfx=all`, `?gfx=none`.
- Tests and the comparison: `game.gfx.trial(['glow', 'mini'])`.

## The comparison

`GFX_DIR=/some/folder node tests/graphics/compare.mjs [--cost]`: five spots (the square on a spring morning, the
beach on a summer day, the lighthouse on an autumn evening, the cottage on a winter night, a close shot of the bean
with Aunt Hazel), each frozen (the game loop stops) and shot with now / each look alone / all four, 1280x720 at
device scale 2, plus `index.html` (a grid per spot). `--cost` adds ms per frame per look (SwiftShader, 1280x720,
scale 1: relative only).

## Steps

1. Plumbing: `game.gfx` (core/gfx.js), the island draws through `IslandLook.render()`; with no look on it draws
   straight to the screen exactly as before. The comparison script; "now" shots taken and looked at (square, beach,
   lighthouse, cottage, close: the name tag reads, the island HUD as usual).
2. Glow and colour (`glow`). Bloom: UnrealBloomPass (quarter-size first mip) that picks up only what carries a glow
   mark in the picture's alpha channel (core/gfx.js markGlow / glowBlend): a first try with a brightness threshold
   bloomed the lamp-lit snowy cottage wall into a white blob (that wall is 3.8x white in linear light at night;
   by day a few pixels reach 1.6), so brightness alone cannot pick the lamps. Marked: lamps and lanterns (M.lamp,
   the lighthouse lamp, the greenhouse lamps), lit windows (M.win, every villager's own), the arcade screens, the
   lighthouse beam and fireflies at night; the magic ball (its own copy of its star material), its aim dots and the
   ghost ship's lanterns always. Colour grade (ShaderPass, linear, before OutputPass): a tint and a little saturation
   by hour (warm morning, neutral day, golden evening, cool blue night) and season (winter cooler, autumn warmer); it
   multiplies, so black outlines stay black. A slow 0.2 Hz breath of the bloom (8 %), none with Reduce flashing.
   Seen: cottage at night (windows and lamps glow softly, the lit wall does not), lighthouse in the evening (lamp
   and beam glow, golden grade), square in the morning (no glow by day, a faint warm tint; the Zip-Zap's tip glows).
3. Softer light (`light`). PCF shadows (PCFSoftShadowMap is gone in three r186: it falls back to PCF with a
   warning; PCF's Vogel-disk filter follows `shadow.radius`, a uniform, so no shader changes): radius 4 instead
   of 1, the bias as before. A faint rim of sky light (fresnel, cube of 1 - N.V, 0.28, half at night) on the bean's
   and the villagers' toon materials (copies swapped in, the originals put back when off). Contact shading: a soft
   dark patch (alpha 0.32) under every static prop on the ground that is 0.75 m or wider (trees, bushes, rocks,
   houses, lamps, benches, fences: map.js footprints(), one InstancedMesh, tilted to the slope) and under the bean
   and each villager (smaller in the air). Single flowers and tufts got one at first and looked spotty: left out.
   Seen: close shot (a light edge on the bean and Aunt Hazel, softer shadow edges), cottage at night and the square
   (trees, lamps, benches and fences sit on the ground).

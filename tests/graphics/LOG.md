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
4. Miniature look (`mini`, went in with step 3's commit). Two ShaderPasses (horizontal, vertical; a 9-tap Gaussian
   on linear filtering, widest step 2.4 px x pixel ratio): sharp in a band of 0.16 (screen heights) around the
   bean's height on screen, blur growing over the next 0.32, a touch more saturation (7 %). Eased (0.3 s) to off in
   menus, panels and dialogs (mode not 'walk'), inside the Game Hall (its boards and signs have text) and the cottage,
   and with Strong outlines on. Name tags, the HUD and toasts are page text and never blurred. Seen: the square
   (top and bottom soft, the bean and the square sharp) and the lighthouse (its top soft, the bean sharp).
5. Living world (`life`). Wind: the baked leaf meshes (seasonlook.js keeps them: trees and bushes, every season's
   colours) and the grass tufts get material copies with a vertex sway (world space: a slow sway plus a small
   per-leaf flutter, 4.5 cm; twice on rainy days, three times the day after a storm); stills cannot show it.
   Water: the island's own water material gets foam where the water is shallow (a 192x192 depth map from
   heightAt, made once when first switched on), a second faint line running out from the shore, and rare slow
   glints further out (dimmer at night). Particles: already there and kept as they are (seasonlook.js petals,
   autumn leaves, snow and snowy roofs; life.js fireflies at night): nothing new is added. With this look the
   fireflies glow up and fade one by one (steady with Reduce flashing) and leaves and petals tumble a little more.
   Seen: the beach (a white foam line along the sand, a few glints: the first try had too many, cut to about a
   third), the lighthouse (foam along the curve of the beach).
6. Settings: Help me play has a "Graphics…" row (its value: "2 of 4 on" or "simple") that opens a page for this
   device: Simple graphics, Glow and colour, Living world, Softer light, Miniature look, Back (en + no strings,
   read aloud like the other rows). The looks are the device's (localStorage `couch.gfx`), not the profile's: a slow
   device is slow for every child on it. A choice made there wins over `?gfx=`. Automatic step-down (core/gfx.js
   measure / judge): only while looks are on from `DEFAULT_LOOK` (never after a choice, never with `?gfx=`), once
   per page: after 2.5 s on the island, 90 frames of the real loop; a median slower than 40 ms (25 fps) saves simple
   graphics (marked `auto`) and shows a toast saying so and where to change it. With `DEFAULT_LOOK` all off (the
   trial) it never runs.
7. Tests: tests/graphics/switches.test.mjs (7 tests). Note for test writers: in SwiftShader a 1280x720 frame with
   the looks on takes about a second of GPU time, the rAF loop queues frames faster than that, and a screenshot then
   waits for the queue: the test pauses the loop for its screenshots (and gives a panel over the island 120 s).

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

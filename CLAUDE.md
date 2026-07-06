# Manav's Black Sandbox

Personal webpage: a first-person three.js world, not a document. Vanilla
three.js + Vite, no framework, no TypeScript. Everything lives in two files:

- `src/main.js` — the entire world (~2,700 lines, organized in commented
  `// ---------- section ----------` blocks, roughly: constants → scene →
  tower → curiosities → reactions → underworld → trail → dice room →
  controls → physics loop → debug panel)
- `index.html` — CSS + DOM overlays (parchment modal, hint bar)

```bash
npm run dev       # Vite dev server on :5173
npm run build     # static build to /dist
```

Open with `#debug` for lil-gui panel, stats, and `window.__sandbox`.

## The aesthetic law

The world is white-on-black, monochrome by law. **Color only exists in
living things**: aurora, glass garden, fireflies, prism light, comet,
collars, golden eyes, the player's trail. The underworld inverts this —
paper-white world where everything is alive (party hats, lollipop trees,
balloons, confetti). Architecture stays uncolored. Respect this when adding
anything.

## Three worlds

1. **Overworld** — the black sandbox, 120×120 (walls at ±60), ceiling
   lattice at 36, fog 8→65.
2. **Underworld** — same geometry, inverted palette, reached by walking
   through the lone door at (−30, 20). `setInverted(on)` swaps
   `INVERT_MATERIALS` colors, background/fog, `body.inverted` CSS, and
   toggles `UNDERWORLD_ONLY` object visibility. Underworld-only colliders
   carry `underworld: true`. Parchment text can differ per world:
   `CLICKABLES` entries accept `text` as a function.
3. **Dice room** — empty void at (700, 700), past the fog. Entered via the
   crooked "weird door" at (16, 28), exited via its twin on the die or by
   falling off (auto-return at feetY < −80). `supportHeightAt` and
   `collide` carve out `x > 400`: no floor, no walls there. The axe
   (`axePivot`, a camera child) is visible only here; left click = swing,
   and clickables/hover are suspended.

## World map (x, z)

| Thing | Where | Notes |
|---|---|---|
| Spawn | (0, 25) | facing −z |
| Leaning tower + READ ME sign | (0, −35) | click tower: groans, leans more, caps at 9° |
| Mirror pool + oracle lectern | (0, 0) / (6.2, 3.2) | Reflector gated < 35 units; fallback disc beneath |
| Graveyard + monument + music box | (26, −13) / (26, −17) / (18, −2) | stones speak; visit all 8 → fruit ceremony |
| Ghost croc | orbits graveyard at y≈4.3 | ticklish |
| Staircase to nowhere + summit | (40, 12), top platform y 22.75 | climbable (STEP_PLATFORMS); summit parchment |
| Launch pad | (33, 17) | boost 16; trampoline |
| Low-gravity crater + prism | (42, −38) | 0.25× gravity inside r 9; prism touchable mid-jump |
| Caged moon | (−40, 26, −40) | click: cage rattles |
| Watchers ×7 | ring at (−40, −40) r 8 | turn when unobserved; click: THE STARE (red eyes, fog closes) |
| Glass garden + fireflies + plaque | (−46, −8) r 6 | crystals swap colors periodically |
| Constellation viewpoint plate | (−10, 6) | anamorphic HELLO aligns from here, toward (−28, 9, −6) |
| Lone door (inversion) + Cerberus | (−30, 20) / (−24.5, 20) | three clickable heads, distinct personalities; body = argument |
| Labyrinth + living miniature | (−32, 40), rings 8/5.8/3.6, gaps N/S/N | mini-you tracks player; clicking it launches the real you |
| Bell / wind chimes | (14, 38) / (−14, 38) | chimes are pentatonic G A C D E, flash note colors |
| Weird door (dice room) | (16, 28) | breathing trapezoid, hue-cycling portal |
| Aurora ribbons | y 26–32, z −49..−55 | shader; clickable (burst) |
| Ghost dragon | lap radius 46, y≈28 | grazes the staircase summit; click: roar |
| Comet | crosses sky every 34 s | gold, 4.5 s transit |

## Core systems (all in main.js)

- **CLICKABLES**: `{ object, text | text() | onClick }`. Raycast walks
  `hits[0].object` up its parent chain to find the entry. Nearest hit wins.
- **COLLIDERS**: axis-aligned `{ x, z, hw, hd, underworld? }`, resolved in
  `collide()` with player radius 0.6. Horizontal only.
- **STEP_PLATFORMS**: one-way walkable tops `{ x, z, cos, sin, hw, hd,
  topY }` (rotated footprints). `supportHeightAt(x, z, refY)` returns the
  highest top ≤ refY. Land when falling, pass through from below, step up
  ≤ 0.45, fall when walking off.
- **Movement**: drag-look only (pointer lock deliberately removed — it is
  broken in Manav's WSL browser). WASD/arrows, Shift sprint (FOV kick),
  C crouch, Space jump + one double jump, E air dash (+ dash-skip: landing
  ≤ 1.5 s after a dash bounces you forward; charges refill on any landing,
  so dash-skimming chains). All tunables in `settings` / debug panel.
- **Audio**: `playPartials([[freq, gain, dur, delay?], …])` — sine partials
  through a lazy AudioContext. Everything audible (bell, chimes, barks,
  roars, whooshes, lullaby) goes through it. No audio assets.
- **Determinism**: `jitter(seed)` for stable layouts. `Math.random()` only
  for runtime flavor (fortunes, crystal swaps, melodies).
- **Performance rules**: merge rigid/static geometry (`mergeGeometries`) —
  one mesh per material batch; InstancedMesh for fields (constellation,
  garden, trail); the Reflector pool renders only within 35 units; exactly
  one point light (the prism). Draw calls ~120 over / ~160 under; check
  `state().drawCalls`. Budget: don't regress below ~30 FPS in headless.

## Debug handle (`#debug` hash)

`window.__sandbox`: `camera`, `settings`, `keys`,
`drop(x, y, z)` (teleport, falling from rest), and `state()` → pos, fov,
grounded, feetY, inverted, bell/watcher/dragon/cerberus state, drawCalls,
frame counter, trail/collar/prism color state, diceWorldActive, etc.

## Testing gotchas (Playwright MCP, hard-won)

- The physics loop **clamps camera y to eye height every frame** — place
  test cameras at y = 1.7 and aim upward with `lookAt`; a camera parked at
  head height gets snapped down while keeping its old aim.
- **Movement ignores the camera quaternion.** Walking uses the module-level
  `yaw`, which only real drags change. `lookAt` in an evaluate does NOT
  turn the walker: W always walks −z after a fresh load. Use S for +z,
  A/D for ±x, or `drop()` to reposition.
- Measure FPS via two `state().frame` samples ~2 s apart, not rAF counting
  (protocol round-trips throttle the page; expect ~30 in headless
  software GL, higher on real GPUs).
- `parchment-text` keeps stale text after Escape — check the `open` class,
  and remember openParchment covers the canvas (Escape between clicks).
- Headless Chromium silently rejects pointer lock; drag-look is the only
  camera path. Screenshots land in repo root — delete before committing.

## History

The repo was a Next.js site (crocodile chasing bouncing fruit) — those
files are buried in the graveyard, literally: the tombstones name them and
git history holds the bodies. No deploy pipeline currently (a GitHub Pages
attempt was reverted pre-migration); the site is meant for a Porkbun
domain eventually. Commits tell the build story — read `git log`.

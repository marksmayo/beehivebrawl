# Beehive Brawl

A satirical 3D comic-book fighting game starring New Zealand politicians. No build step: Three.js loads from a CDN.

**Play online:** https://beehivebrawl.vercel.app

**Play locally:** serve the folder (browsers block ES modules on `file://`), e.g. `npm run serve` or `python -m http.server`, then open http://localhost:8765. It needs an internet connection for Three.js and the fonts.

- 8 fighters, each with a special A, a special B, a super, and their own catchphrases
- 8 painted arenas: the Beehive, the Viaduct, Cathedral Square, the Octagon, the Queenstown waterfront, Waitangi, Lake Taupō, and the summit of Mauao
- 1P vs CPU (3 difficulty levels), or 2P on one keyboard or with gamepads

## Controls

| | Solo (1P) | 2P: player 1 | 2P: player 2 |
|---|---|---|---|
| Move / jump / block | WASD or arrows | WASD | arrows |
| Punch, kick | J, K | F, G | Num1 / `,`, Num2 / `.` |
| Special A, special B, super | L, I, O | H, R, T | Num3 / `/`, Num4 / `;`, Num5 / `'` |

M toggles sound, V toggles voices, Esc pauses.

## How it's made

- `index.html` + `src/*.js`: the game as ES modules (Three.js, cel shading with ink outlines). `src/main.js` is the entry point.
- Arenas are illustrated panoramas painted in code with Canvas 2D, wrapped on a curved backdrop behind a painted 3D floor.
- Fighters are caricature sculpts generated in Blender by `tools/make_fighters.py`. Overlapping primitives are voxel-remeshed into smooth heads, hair, suits, hands and shoes, then exported to `models/fighters.js` (a base64 GLB, so the game also runs straight off the disk). Faces are drawn, not modelled: inked brows, eyes and mouths are painted onto the heads at runtime, with neutral, shouting and hurt expressions.

Regenerate the models (Blender 4.2+):

```
blender -b --factory-startup --python tools/make_fighters.py -- models/fighters.glb
```

## Tests

```
npm install
npm test          # unit tests (node:test)
npm run test:e2e  # boots the game in headless Chrome and plays a round
```

See [ROADMAP.md](ROADMAP.md) for the list of planned visual improvements.

Satire and parody. Not affiliated with any political party or politician.

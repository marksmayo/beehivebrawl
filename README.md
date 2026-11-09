# Beehive Brawl

A satirical 3D comic-book fighting game starring New Zealand politicians. No build step: Three.js loads from a CDN.

**Play online:** https://beehivebrawl.vercel.app

**Play locally:** serve the folder (browsers block ES modules on `file://`), e.g. `npm run serve` or `python -m http.server`, then open http://localhost:8765. It needs an internet connection for Three.js and the fonts.

- 8 fighters, each with a special A, a special B, a super, a throw, a taunt and their own catchphrases
- 13 painted arenas: the Beehive, the Viaduct, Cathedral Square, the Octagon, the Queenstown waterfront, Waitangi, Lake Taupō, the summit of Mauao, the Debating Chamber, Aoraki / Mount Cook, Cuba Street, Ponsonby Road and Select Committee Room 3, each by day, at sunset or at night
- 1P vs CPU (3 difficulty levels), or 2P on one keyboard or with gamepads; on-screen touch controls on phones and tablets

## Controls

| | Solo (1P) | 2P: player 1 | 2P: player 2 |
|---|---|---|---|
| Move / jump | WASD or arrows | WASD | arrows |
| Punch, kick | J, K | F, G | Num1 / `,`, Num2 / `.` |
| Special A, special B, super | L, I, O | H, R, T | Num3 / `/`, Num4 / `;`, Num5 / `'` |
| Taunt (builds meter if it finishes) | U | Y | Num6 / `]` |

- **Block:** hold back against an attack for a high guard (stops punches and specials), hold down for a low guard (stops kicks).
- **Dash:** double-tap forward or back. **Throw:** forward + punch up close.
- **Wake-up roll:** hold a direction while knocked down.
- **Cancels:** a punch or kick that lands can cancel straight into a special or super. Presses made during recovery are buffered.
- **Select screen:** Tab changes the venue, C changes your outfit (Parliament, campaign hi-vis, beach, election night).
- M toggles sound, V toggles voices, Esc pauses.
- **Touch:** a floating thumbstick on the left, buttons on the right.

## How it's made

- `index.html` + `src/*.js`: the game as ES modules (Three.js). `src/main.js` is the entry point.
- **Look:** cel shading with warm shadows and cool highlights, halftone dots in the shadows only, brushy ink outlines, a party-colour rim light, and a print pass (plate misregistration, paper grain, per-arena colour grade).
- **Arenas:** illustrated panoramas painted in code with Canvas 2D (8192 px on desktop), wrapped on a curved backdrop with parallax sky and cloud layers, behind a painted 3D floor. They have weather, hazards, crowds, props that break, billboards and ambient sound.
- **Fighters:** caricature sculpts generated in Blender by `tools/make_fighters.py`. Overlapping primitives are voxel-remeshed into smooth heads, hair, suits, hands and shoes, then exported to `models/fighters.js` (a base64 GLB). Sleeves and trouser legs are skinned two-bone meshes. Faces are painted at runtime, with decals for eyes that track, brows, a lip-sync mouth and mood marks. Animation is a keyframed pose library (`src/anim.js`).
- Game rules and presentation logic live in pure modules (`anim`, `camerafx`, `fxlogic`, `ui`, `arenadata`, `charlogic`, `touch`, `controls`) that are unit tested.

Regenerate the models (Blender 4.2+):

```
blender -b --factory-startup --python tools/make_fighters.py -- models/fighters.glb
```

## Tests

```
npm install
npm test          # unit tests (node:test)
npm run test:e2e  # boots the game in headless Chrome and plays it (desktop and phone)
```

See [ROADMAP.md](ROADMAP.md) for the visual roadmap and what's done.

Satire and parody. Not affiliated with any political party or politician.

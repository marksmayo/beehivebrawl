# Beehive Brawl: 100 visual improvements

Ranked roughly by impact within each section. ★ = biggest bang for the buck.

## Characters: look & caricature
1. ★ Hand-painted face textures per politician (artist or AI-assisted), replacing the procedurally drawn ones
2. ★ Painted hair textures with strand clumps and ink strokes instead of plain toon-shaded hair shells
3. ★ Bigger-head, smaller-body proportions (head ≈ 1/3 of height) for a stronger caricature read
4. Proper skinned, rigged meshes (one mesh, bone weights) so elbows, knees and shoulders bend instead of capsules pivoting
5. Sculpted hands with fingers (open palm, fist, point, thumbs-up), swapped per pose
6. Suit fabric detail: lapel stitching, pocket squares, button holes, trouser creases painted into textures
7. Signature props per fighter: Luxon's pen, Hipkins' Diet Coke, Seymour's leopard-print, Peters' pocket square
8. Per-fighter silhouettes: Brownlee wider, Seymour shorter and wirier, Swarbrick slimmer, Luxon taller
9. Alternate costumes (press-conference, campaign hi-vis, beach, election-night) selectable on the select screen
10. Party-coloured rosettes / lapel pins on every fighter
11. Shoes with laces, heels and soles that flex with the walk cycle
12. Skin tone shading ramp tuned per fighter (warm shadow colours instead of grey)
13. Subtle rim light per fighter in their party colour
14. Eye whites and highlights that track the opponent (look-at on the painted eyes)
15. Eyebrow animation as a separate decal layer (raise, furrow, waggle)
16. Lip-sync mouth shapes (5–6 visemes) driven by the catch-phrase text
17. Sweat drops, blush and "veins" decals when hurt or angry
18. Bruise / plaster / black-eye decals that accumulate across rounds
19. Torn tie, loosened collar and rumpled hair when HP is low
20. Victory outfits: confetti-covered, crown, champagne-soaked

## Animation & movement
21. ★ Proper keyframed or mocapped animation sets (idle, walk, run, jump, crouch, block, hit, KO, taunt), e.g. Mixamo
22. ★ Anticipation → strike → follow-through on every attack (wind-up frames, overshoot, settle)
23. Distinct idle per character (Luxon checks watch, Hipkins sips Diet Coke, Peters adjusts tie, Seymour bounces)
24. Signature walk cycles (Brownlee's stomp, Seymour's dance-step, Swarbrick's brisk stride)
25. Hit reactions that differ by height (head snap, gut fold, leg sweep) and direction
26. Ragdoll-style KO fall with bounce and dust puff
27. Getting-up animation and wake-up roll
28. Run / dash with lean and dust trail
29. Double-jump / air-dash flips with squash and stretch
30. Throws and grabs (lapel grab, headlock, the "fiscal hug")
31. Super-move cinematics with camera cuts, freeze-frame and character close-up
32. Taunt button with voiced catch-phrase and unique gesture
33. Round-start intros per character (Peters strides in waving, Luxon steps off a plane)
34. Victory poses (2–3 per character) and loser reactions
35. Smear frames / motion trails on fast limbs
36. Secondary motion: tie flapping, hair bounce, jacket tail swing
37. Hit-stop tuned per attack strength, with a tiny camera punch-in
38. Footstep IK so feet plant on the floor and don't slide
39. Facing turn animation instead of an instant flip
40. Blocking stance that changes with high/low guard

## Effects & comic style
41. ★ Hand-drawn impact frames (black/white inverted flash panel) on supers and KOs
42. ★ Comic onomatopoeia with hand-lettered fonts and per-hit colour, popping in 3D space
43. Speed-line backgrounds during dashes and supers
44. Ink-splat hit sparks instead of particles
45. Dust clouds, debris and paper (policy documents!) flying on heavy hits
46. Stylised smoke and fire for Seymour's bonfire, Ngāuruhoe and the DC-3
47. Screen-space halftone shading in the shadows only (not overlaid on everything)
48. Variable-width ink outlines (thicker at silhouette, thinner inside) via a post-process edge pass
49. Paper-grain / print-misregistration post filter (subtle CMYK offset)
50. Comic panel borders and gutters for intros, round transitions and the results screen
51. Speech bubbles with tails that follow the speaker, shake when shouting, and pop with a bounce
52. KO "stamp" splashed across the screen (VOTE OF NO CONFIDENCE!)
53. Combo counter in comic lettering that grows and wobbles
54. Super-meter fill with ink-wash animation and sparkle when full
55. Portraits that swap expression in the HUD when hit or winning

## Arenas & backgrounds
56. ★ Hand-painted (or AI-assisted, then retouched) high-res panorama per arena
57. ★ Parallax layers: sky, far hills, buildings, near props, each at a different depth
58. Animated background crowds (protesters, press pack, tourists) reacting to big hits
59. Time-of-day variants per arena (dawn, noon, sunset, night with lit windows)
60. Weather per arena: Wellington wind with flying umbrellas, Dunedin drizzle puddles, Taupō heat haze
61. Painted floor decal centre-pieces (fern koru mosaic, Octagon star, Treaty grounds lawn markings)
62. Breakable props: road cones, lecterns, café tables, flower boxes
63. Interactive hazards: the Christchurch tram crossing, Viaduct bridge opening, Mauao sheep stampede
64. Animated water with scrolling painted ripples and bobbing boats
65. Drifting clouds and birds (kererū, gulls, tūī) on a separate layer
66. Background characters doing cameos (former PMs in the crowd, a press gallery with cameras flashing)
67. Signage and billboards with satirical slogans that change each round
68. More NZ arenas: Parliament debating chamber, Hobbiton, Aoraki, Cuba Street, Ponsonby café strip, a select committee room
69. A stage intro fly-through that ends on the fight camera
70. Arena-specific ambient audio (gulls, trams, wind, cicadas)

## Lighting & rendering
71. Soft cel ramps with warm shadows and cool highlights (custom toon shader)
72. Contact shadows / ambient occlusion under feet
73. Character rim lighting from the backdrop's sky colour
74. Shadow colour tinted by the arena (purple at sunset, blue in the shade)
75. Light bloom on super-move effects only
76. Depth-of-field blur on the backdrop during cinematics
77. Colour grading LUT per arena
78. MSAA / FXAA tuned so outlines stay crisp on high-DPI screens
79. Dynamic lighting flashes (camera flashes from the press pack)
80. Higher-resolution backdrops on desktop, lower on mobile

## UI & presentation
81. ★ Animated character-select with full-body idle previews and a "VS" splash screen
82. Big comic-style name cards when each round starts
83. Health bars styled as polling graphs that drain with a ticker
84. Round timer as a ballot-counting clock
85. Results screen as a newspaper front page with a headline about the winner
86. Animated title screen with the cast posing in a comic cover
87. Character bios as comic panels with key "quotes"
88. Unlockable concept-art gallery
89. Pause menu styled like a parliamentary order paper
90. Mobile touch controls with comic-button styling

## Camera & game feel
91. ★ Dynamic camera that zooms in on close combos and widens on spread-out fighters, with slight Dutch tilts
92. Camera shake tuned by hit weight with directional punch
93. Slow-motion final KO with zoom and colour desaturation
94. Replay of the winning blow from a new angle
95. Cinematic camera paths for super moves
96. Screen-edge vignette pulse on low health
97. Controller rumble synced to hits
98. Input-reactive animation (cancelling, buffering) so movement feels snappy
99. Footsies spacing: walk-speed curves and dash momentum
100. Training mode with hitbox visualisation for tuning animation timing

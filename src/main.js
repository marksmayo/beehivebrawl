// Entry point: boot the game.
import { game, toTitle } from './game.js';
import { frame, post } from './loop.js';
import { bubble } from './dom.js';
import { loadParts } from './parts.js';
import { makePortraits } from './portraits.js';
import { camera, scene } from './renderer.js';

await loadParts();
makePortraits();
toTitle();
requestAnimationFrame(frame);
// end-to-end tests read game state through this (only with ?test in the URL)
if (new URLSearchParams(location.search).has('test')) window.__bb = { game, camera, scene, post, bubble };

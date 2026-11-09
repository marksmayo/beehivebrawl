// Entry point: boot the game.
import { game, toTitle } from './game.js';
import { frame, post } from './loop.js';
import { bubble } from './dom.js';
import { loadParts } from './parts.js';
import { makePortraits } from './portraits.js';
import { camera, scene, sun } from './renderer.js';
import * as AR from './arenas.js';
import { Fighter } from './fighter.js';
import { ROSTER } from './roster.js';
import { currentAmbience } from './audio.js';

const boot = { start:performance.now() };
await loadParts(); boot.parts = performance.now();
makePortraits(); boot.portraits = performance.now();
toTitle(); boot.title = performance.now();
requestAnimationFrame(frame);
// end-to-end tests read game state through this (only with ?test in the URL)
if (new URLSearchParams(location.search).has('test')) window.__bb = { boot, game, camera, scene, post, bubble, sun, makeFighter:id => new Fighter(ROSTER.find(d => d.id === id), 0), arena:{
  STAGES:AR.STAGES, build:(st, o) => AR.buildStage(st, o), current:() => AR.stageGroup, get crowd() { return AR.stageFx.crowd; },
  props:() => AR.stageFx.props, billboardText:() => AR.stageFx.billboardText(), skipHazardTo:s => AR.stageFx.skipHazardTo(s), ambience:currentAmbience } };

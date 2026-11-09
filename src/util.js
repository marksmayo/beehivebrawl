import * as THREE from 'three';

// Utilities

const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[(Math.random() * a.length) | 0];
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const hex = c => '#' + new THREE.Color(c).getHexString();


const SPEED = 4.8, JUMP = 10.5, GRAV = 27, BOUND = 9.4, MAXSEP = 11.5;

export { $, rand, clamp, pick, damp, hex, SPEED, JUMP, GRAV, BOUND, MAXSEP };

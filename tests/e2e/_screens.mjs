// dev helper: screenshot every screen. usage: node tests/e2e/_screens.mjs out-prefix
import { writeFileSync } from 'node:fs';
import { serve, browser, sleep } from './harness.mjs';
const out = process.argv[2], srv = await serve(), page = await browser({ width:1280, height:720 });
const snap = async n => writeFileSync(`${out}-${n}.png`, await page.shot());
await page.goto(srv.url + '?test'); await page.waitFor(`window.__bb?.game.phase === 'title'`); await sleep(1500); await snap('title');
await page.key('Enter'); await sleep(900); await snap('select');
await page.key('KeyJ'); await page.waitFor(`document.querySelector('#vs').classList.contains('on')`, 10000); await sleep(900); await snap('vs');
await page.waitFor(`document.querySelectorAll('#namecards .ncard.on').length === 2`, 60000); await sleep(400); await snap('names');
await page.waitFor(`__bb.game.phase === 'fight'`, 60000); await page.eval(`__bb.game.p[1].hp = 63`); await sleep(2500); await snap('hud');
await page.key('Escape'); await sleep(600); await snap('pause'); await page.key('Escape');
const win = async () => { await page.eval(`(() => { const [a, b] = __bb.game.p; b.hp = 0; __bb.game.ko(b, a, 1); })()`); await page.waitFor(`__bb.game.phase === 'ko'`, 5000); await page.eval(`__bb.game.phaseT = 99`); };
await win(); await page.waitFor(`__bb.game.phase === 'fight'`, 60000); await win();
await page.waitFor(`__bb.game.phase === 'result'`, 20000); await sleep(800); await snap('result');
await page.eval(`document.querySelector('#bMenu').click()`); await sleep(1200); await page.eval(`document.querySelector('#bGallery').click()`); await sleep(500); await snap('gallery');
page.close(); srv.close(); process.exit(0);

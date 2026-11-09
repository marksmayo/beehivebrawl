// dev helper: screenshots of a fight. usage: node tests/e2e/_look.mjs out-prefix [stageIndex]
import { writeFileSync } from 'node:fs';
import { serve, browser, sleep } from './harness.mjs';
const out = process.argv[2], si = +(process.argv[3] ?? -1);
const srv = await serve(), page = await browser({ width:1280, height:720 });
await page.goto(srv.url + '?test'); await page.waitFor(`window.__bb?.game.phase === 'title'`);
await page.key('Enter'); await sleep(800);
if (si >= 0) for (let i = 0; i < 8 && (await page.eval(`__bb.game.stageIdx`)) !== si; i++) await page.key('Tab');
await page.key('KeyJ');
await page.waitFor(`__bb.game.phase === 'intro'`, 60000); await sleep(1200);
writeFileSync(out + '-intro.png', await page.shot());
await page.waitFor(`__bb.game.phase === 'fight'`, 60000);
await page.eval(`__bb.game.ai.think = () => ({})`);
await page.eval(`(() => { const [a, b] = __bb.game.p; a.x = -1.1; b.x = 1.1; })()`);
await sleep(1500); writeFileSync(out + '-guard.png', await page.shot());
await page.key('KeyJ', 100); await sleep(450); writeFileSync(out + '-punch.png', await page.shot());
await sleep(2500); await page.key('KeyK', 100); await sleep(500); writeFileSync(out + '-kick.png', await page.shot());
await sleep(2500); await page.eval(`dispatchEvent(new KeyboardEvent('keydown', { code:'KeyS', bubbles:true }))`); await sleep(1500); writeFileSync(out + '-low.png', await page.shot());
page.close(); srv.close(); process.exit(0);

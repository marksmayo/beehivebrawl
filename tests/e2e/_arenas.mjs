// dev helper: screenshot venues. usage: node tests/e2e/_arenas.mjs out-prefix id:tod ...
import { writeFileSync } from 'node:fs';
import { serve, browser, sleep } from './harness.mjs';
const [out, ...list] = process.argv.slice(2), srv = await serve(), page = await browser({ width:1280, height:720 });
await page.goto(srv.url + '?test'); await page.waitFor(`window.__bb?.game.phase === 'title'`);
await page.eval(`document.querySelector('#title').classList.add('hidden')`);
for (const item of list) {
  const [id, tod = 'day'] = item.split(':');
  await page.eval(`(() => { const ar = __bb.arena; ar.build(ar.STAGES.find(s => s.id === '${id}'), { tod:'${tod}' }); })()`);
  await sleep(2500); writeFileSync(`${out}-${id}-${tod}.png`, await page.shot());
}
page.close(); srv.close(); process.exit(0);

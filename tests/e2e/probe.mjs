// Debug helper: import modules in a page and report load errors or hangs.
// (in a copy of index.html without the entry script)
// usage: node tests/e2e/probe.mjs module [module ...]
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { serve, browser, sleep } from './harness.mjs';

const BLANK = new URL('../../_probe.html', import.meta.url); // in the repo root so relative paths resolve
writeFileSync(BLANK, readFileSync(new URL('../../index.html', import.meta.url), 'utf8').replace('<script type="module" src="src/main.js"></script>', ''));
const srv = await serve(), page = await browser();
await page.goto(srv.url + (process.env.PAGE ?? '_probe.html')); await sleep(2500);
for (const m of process.argv.slice(2)) {
  const expr = `import('/src/${m}.js').then(() => 'ok', e => 'ERR ' + e.message + ' @ ' + String(e.stack).split('\\n').slice(1, 3).join(' | '))`;
  const res = await Promise.race([page.send('Runtime.evaluate', { expression:expr, awaitPromise:true, returnByValue:true }), sleep(+(process.env.WAIT ?? 10000)).then(() => null)]);
  console.log(m, res ? JSON.stringify(res.result?.result?.value ?? res.result ?? res).slice(0, 500) : 'HANG');
}
if (page.errors.length) console.log('page errors:\n' + page.errors.slice(0, 5).join('\n'));
page.close(); srv.close(); rmSync(BLANK); process.exit(0);

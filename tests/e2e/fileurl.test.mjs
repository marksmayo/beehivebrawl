// Opened straight from disk (file://), the page can't load its modules: it must say so
// instead of looking dead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { browser, sleep } from './harness.mjs';

test('opening index.html from disk explains how to run the game', async () => {
  const page = await browser();
  try {
    await page.goto(pathToFileURL(resolve(import.meta.dirname, '../../index.html')).href);
    await sleep(2000);
    const msg = await page.eval(`(() => { const e = document.querySelector('#fileNotice'); return e && getComputedStyle(e).display !== 'none' ? e.textContent : null; })()`);
    assert.ok(msg, 'no notice shown on file://');
    assert.match(msg, /npm run serve|http\.server/);
    assert.match(msg, /beehivebrawl\.vercel\.app/);
  } finally { page.close(); }
});

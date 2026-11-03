import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';

const root = path.resolve('design');
const output = path.resolve('work/design-checks');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    assert.ok(!path.relative(root, target).startsWith('..'));
    response.setHeader('Content-Type', types[path.extname(target)] ?? 'application/octet-stream');
    response.end(await readFile(target));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/index.html?theme=dark`);
    await page.getByRole('heading', { name: 'Те же сайты. Другой взгляд.', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Горизонтальная прокрутка');
    if (viewport.width >= 1300) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'Главная страница не помещается по высоте');
    }
    await page.screenshot({ path: path.join(output, `site-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['dark', 'light']) {
    await page.goto(`${base}/brand.html?theme=${theme}`);
    await page.getByRole('heading', { name: 'Своя форма. Свой характер.' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.logo-proposal').count(), 4);
    await page.screenshot({ path: path.join(output, `brand-${theme}.png`), fullPage: true });
  }
  await page.goto(`${base}/prototype.html?theme=dark`);
  await page.getByRole('radio', { name: 'Полночь', exact: true }).click();
  assert.equal(await page.getByRole('radio', { name: 'Полночь', exact: true }).getAttribute('aria-checked'), 'true');
  await page.getByRole('tab', { name: 'Разработка', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'prototype-development.png') });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Выгрузить/ }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^night\.zip$/);
  const profile = { schemaVersion: 1, id: 'import-test', name: 'Новый вариант', version: '1.0.0', style: 'paper', site: 'journal.example', colors: ['#fbf1c7', '#282828', '#d65d0e'] };
  const zip = zipSync({ 'profile.json': strToU8(JSON.stringify(profile)), 'styles.css': strToU8(':root { --preview-bg: #fbf1c7; }') });
  await page.locator('#zip-input').setInputFiles({ name: 'new.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await page.getByRole('radio', { name: 'Новый вариант', exact: true }).waitFor();
  await page.getByRole('radio', { name: 'Новый вариант', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'prototype-appearance.png') });
  await page.getByRole('button', { name: 'Удалить Новый вариант', exact: true }).click();
  assert.equal(await page.getByRole('radio', { name: 'Новый вариант', exact: true }).count(), 0);
  assert.ok((await page.locator('#original-option').getAttribute('class')).includes('selected'));
  await page.getByRole('tab', { name: 'Разработка', exact: true }).click();
  const baseDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Выгрузить/ }).click();
  assert.match((await baseDownload).suggestedFilename(), /^my-appearance-/);
  assert.deepEqual(errors, []);
  console.log('Проверены размеры страницы, обе темы, выбор, импорт, удаление и выгрузка ZIP.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const extensionPath = path.resolve('dist/chrome');
const profile = await mkdtemp(path.join(tmpdir(), 'pageforge-browser-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker');
  const workerUrl = new URL(worker.url());
  const extensionOrigin = `${workerUrl.protocol}//${workerUrl.hostname}`;
  const page = await context.newPage();
  const errors = [];
  const remoteRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  await page.setViewportSize({ width: 400, height: 580 });
  await page.goto(`${extensionOrigin}/index.html`);
  await page.getByRole('button', { name: 'Разработка', exact: true }).waitFor({ timeout: 60000 });
  await page.getByText('Здесь появятся ваши варианты', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Разработка', exact: true }).click();
  await page.getByText('Перетащить ZIP или выбрать файл', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Отображение', exact: true }).click();
  await page.getByText('Здесь появятся ваши варианты', { exact: true }).waitFor();
  const browserContext = JSON.parse(await page.evaluate(() => pageForge.getContext()));
  assert.match(browserContext.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof browserContext.siteLabel, 'string');
  assert.deepEqual(errors, [], 'Ошибки запуска интерфейса');
  assert.deepEqual(remoteRequests, [], 'Интерфейс обращается к внешним ресурсам');
  console.log('Расширение загружено: Flutter, переключение вкладок и связь с браузером работают.');
} finally {
  await context?.close();
  const resolved = path.resolve(profile);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('pageforge-browser-'));
  await rm(resolved, { recursive: true, force: true });
}


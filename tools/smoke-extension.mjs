import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const work = path.resolve('work');
await mkdir(work, { recursive: true });
const extensionPath = await mkdtemp(path.join(work, 'browser-extension-'));
await cp(path.resolve(process.env.PAGEFORGE_EXTENSION_PATH ?? 'dist/chrome'), extensionPath, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
assert.equal(manifest.host_permissions, undefined);
// Заранее выдан только доступ к тестовому сайту: эквивалент принятого запроса permissions.request.
// Проверка системного окна выдачи разрешения остаётся ручной.
manifest.host_permissions = ['http://127.0.0.1/*', 'https://api.github.com/*', 'https://codeload.github.com/*'];
await writeFile(path.join(extensionPath, 'manifest.json'), JSON.stringify(manifest));

const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:");
  response.end(`<!doctype html><html lang="ru"><head><title>PageForge fixture</title><style>body{background:#fff;color:#222;font:16px sans-serif} main{padding:32px}</style></head><body><main><h1>Исходный заголовок</h1><p>Содержимое страницы</p><div id="noise">Лишний блок</div><button id="counter">0</button><input value="private-token"><a href="/next?token=private-token">Далее</a></main><script>let count=0;document.querySelector('#counter').onclick=()=>document.querySelector('#counter').textContent=String(++count);</script></body></html>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = `http://127.0.0.1:${server.address().port}/page?token=private-token`;
const profilePath = await mkdtemp(path.join(tmpdir(), 'pageforge-browser-'));
const diagnostics = path.resolve('work/browser-checks');
await mkdir(diagnostics, { recursive: true });
let context;
let popup;
let worker;
let origin;
const errors = [];
const remoteRequests = [];

async function launch() {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  // Playwright сохраняет загрузки во временные файлы с UUID.
  // Проверяем имя в настоящем вызове API, сохраняя сам вызов download.
  await worker.evaluate(() => {
    globalThis.__pageForgeDownloadNames = [];
    const download = chrome.downloads.download.bind(chrome.downloads);
    chrome.downloads.download = (options) => {
      globalThis.__pageForgeDownloadNames.push(options.filename);
      return download(options);
    };
  });
  const url = new URL(worker.url());
  origin = `${url.protocol}//${url.hostname}`;
}

function theme(id, name, mode = 'css', css = 'body { background: #fbf1c7 !important; }', extra = {}) {
  return zipSync({
    'profile.json': strToU8(JSON.stringify({ schemaVersion: 1, id, name, version: '1.0.0', mode, matches: ['http://127.0.0.1/*'] })),
    'styles.css': strToU8(css),
    'rules.json': strToU8('{"hide":["#noise"],"bindings":[]}'),
    'assets/note.txt': strToU8('Ресурс должен сохраниться'),
    ...extra,
  });
}

async function openPopup(tabId) {
  popup = await context.newPage();
  popup.on('pageerror', (error) => errors.push(error.message));
  popup.on('response', (response) => { if (response.status() >= 400) errors.push(`Ресурс ${response.url()}: ${response.status()}`); });
  popup.on('request', (request) => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await popup.setViewportSize({ width: 380, height: 580 });
  await popup.goto(`${origin}/index.html?tab=${tabId}`);
  await popup.getByRole('button', { name: 'Разработка', exact: true }).waitFor({ timeout: 60000 });
  const frame = await popup.locator('#pageforge-app').evaluate((element) => {
    const style = getComputedStyle(element);
    return { radius: style.borderRadius, overflow: style.overflow, width: element.offsetWidth, height: element.offsetHeight };
  });
  assert.deepEqual(frame, { radius: '0px', overflow: 'hidden', width: 380, height: 580 });
}

async function command(name, args = {}) {
  return JSON.parse(await popup.evaluate(({ name, args }) => pageForge.command(name, JSON.stringify(args)), { name, args }));
}

async function upload(archive) {
  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Разработка', exact: true }).click();
  const chooser = popup.waitForEvent('filechooser');
  await popup.getByRole('button', { name: 'Добавить ZIP', exact: true }).click();
  await (await chooser).setFiles({ name: 'appearance.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) });
}

async function exportedFiles(tabId, id, filename = '127.0.0.1.zip') {
  const result = await command('export', { tabId, id });
  assert.equal(result.error, undefined);
  assert.equal(result.message, `Архив передан браузеру: ${filename}`);
  const [download] = await worker.evaluate((downloadId) => chrome.downloads.search({ id: downloadId }), result.downloadId);
  assert.equal(await worker.evaluate(() => globalThis.__pageForgeDownloadNames.at(-1)), filename);
  assert.ok(download.url.startsWith(`data:application/zip;pageforge-name=${filename};base64,`));
  return unzipSync(Buffer.from(download.url.split(',')[1], 'base64'));
}

try {
  await launch();
  const site = await context.newPage();
  await site.goto(address);
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url).id, address);
  await openPopup(tabId);
  await popup.getByText('Пока нет оформлений', { exact: true }).waitFor();
  const css = theme('paper', 'Бумага');
  await upload(css);
  await popup.getByRole('button', { name: 'Применить Бумага', exact: true }).waitFor();
  // Активируем сайт: при отсутствии activeTab API снимка честно оставляет превью отложенным.
  await site.bringToFront();
  await worker.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let index = 0; index < 60; index++) {
      const profile = await PageForgeStore.get('paper');
      if (profile.lastPreviewAttempt && profile.previewState !== 'capturing') return;
      await wait(100);
    }
    throw new Error('Подготовка превью не завершилась');
  });
  assert.equal(await site.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Применить Бумага', exact: true }).click();
  await site.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(251, 241, 199)');
  assert.equal(await site.locator('#noise').isVisible(), false);
  await site.locator('#counter').click();
  assert.equal(await site.locator('#counter').innerText(), '1');
  const updated = theme('paper', 'Бумага', 'css', 'body { background: #fbf1c7 !important; } p { font-weight:700 !important; }', {
    'profile.json': strToU8(JSON.stringify({ schemaVersion: 1, id: 'paper', name: 'Бумага', version: '1.0.1', mode: 'css', matches: ['http://127.0.0.1/*'] })),
  });
  await upload(updated);
  await site.waitForFunction(() => getComputedStyle(document.querySelector('p')).fontWeight === '700');
  await popup.getByRole('button', { name: 'Применить Бумага', exact: true }).waitFor();
  assert.equal(await popup.getByRole('button', { name: 'Применить Бумага', exact: true }).count(), 1);
  const files = await exportedFiles(tabId, 'paper');
  assert.equal(strFromU8(files['assets/note.txt']), 'Ресурс должен сохраниться');
  assert.match(strFromU8(files['styles.css']), /fbf1c7/);
  assert.equal(JSON.parse(strFromU8(files['profile.json'])).version, '1.0.1');
  await site.reload();
  await site.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(251, 241, 199)');

  const broken = theme('broken', 'Неверное правило', 'css', 'body{background:red!important}', { 'rules.json': strToU8('{"hide":["["],"bindings":[]}') });
  const imported = await command('import', { tabId, archive: Buffer.from(broken).toString('base64') });
  assert.equal(imported.error, undefined);
  const rejected = await command('select', { tabId, id: 'broken', originPattern: 'http://127.0.0.1/*' });
  assert.ok(rejected.error);
  assert.equal(await site.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(251, 241, 199)');
  assert.equal((await command('state')).selectedId, 'paper');
  await command('delete', { id: 'broken' });

  const layout = theme('layout', 'Своя разметка', 'layout', '.pageforge-root { background:#282828;color:#fbf1c7;padding:24px; }', {
    'layout.html': strToU8('<main><h1 id="title"></h1><p id="value"></p><button id="mirror">Нажать</button><script>window.__pageforgeUnsafe=true</script><img src="x" onerror="window.__pageforgeUnsafe=true"><iframe src="https://remote.invalid"></iframe></main>'),
    'rules.json': strToU8(JSON.stringify({ hide: [], bindings: [{ source: 'h1', target: '#title', kind: 'text' }, { source: '#counter', target: '#value', kind: 'text' }, { source: '#counter', target: '#mirror', kind: 'click' }] })),
  });
  await upload(layout);
  await popup.getByRole('button', { name: 'Применить Своя разметка', exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Применить Своя разметка', exact: true }).click();
  await site.locator('.pageforge-root #title').waitFor();
  assert.equal(await site.locator('.pageforge-root #title').innerText(), 'Исходный заголовок');
  assert.equal(await site.locator('body > main').isVisible(), false);
  assert.equal(await site.locator('.pageforge-root script, .pageforge-root iframe, .pageforge-root [onerror]').count(), 0);
  assert.equal(await site.evaluate(() => window.__pageforgeUnsafe), undefined);
  await site.locator('#mirror').click();
  await site.waitForFunction(() => document.querySelector('.pageforge-root #value').textContent === '1');
  await command('select', { tabId, id: null });
  await site.locator('body > main').waitFor();
  assert.equal(await site.locator('.pageforge-root').count(), 0);
  await site.locator('#counter').click();
  assert.equal(await site.locator('#counter').innerText(), '2');
  const starter = await exportedFiles(tabId, null);
  assert.ok(starter['reference/page.html']);
  assert.ok(starter['reference/styles.css']);
  assert.ok(starter['reference/computed.json']);
  assert.equal(strFromU8(starter['reference/page.html']).includes('private-token'), false);

  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Разработка', exact: true }).click();
  await popup.getByRole('button', { name: 'Добавить ZIP', exact: true }).waitFor();
  const dropped = theme('dropped', 'Перетаскивание');
  await popup.evaluate((data) => {
    const target = document.querySelector('[flt-semantics-identifier="pageforge-import"]');
    const bounds = target.getBoundingClientRect();
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], 'drop.zip', { type: 'application/zip' }));
    document.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 }));
    // После завершения настоящего drop браузер закрывает доступ к FileList.
    // Искусственный DataTransfer сам этого не делает — очищаем его явно.
    transfer.items.clear();
    if (transfer.files.length !== 0) throw new Error('FileList не очищен после drop');
  }, [...dropped]);
  await popup.getByRole('button', { name: 'Применить Перетаскивание', exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Удалить Перетаскивание', exact: true }).click();

  const repositoryZip = zipSync({
    'repo-sha/profile.json': strToU8(JSON.stringify({ schemaVersion: 1, id: 'repository', name: 'Из репозитория', version: '1.0.0', mode: 'css', matches: ['http://127.0.0.1/*'] })),
    'repo-sha/styles.css': strToU8('body { background: #32302f !important; }'),
  });
  await worker.evaluate((data) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (/^https:\/\/api\.github\.com\/repos\/(fixture\/theme|Hecatoncheir\/PageForge)\/releases\?per_page=20$/.test(url)) {
        const app = url.includes('/Hecatoncheir/PageForge/');
        const version = app ? '9.0.0' : '1.0.1';
        const response = new Response(JSON.stringify([{ tag_name: `v${version}`, draft: false, published_at: '2026-11-04T00:00:00Z', assets: ['chrome', 'firefox'].map((browser) => ({ name: `pageforge-${browser}-${version}.zip`, state: 'uploaded' })) }]));
        Object.defineProperty(response, 'url', { value: url });
        return response;
      }
      if (url !== 'https://api.github.com/repos/fixture/theme/zipball/HEAD') return originalFetch(url, options);
      const response = new Response(new Uint8Array(data));
      Object.defineProperty(response, 'url', { value: 'https://codeload.github.com/fixture/theme/legacy.zip/HEAD' });
      return response;
    };
  }, [...repositoryZip]);
  await popup.getByRole('button', { name: 'Разработка', exact: true }).click();
  const deniedImport = await popup.evaluate(async () => {
    const request = chrome.permissions.request;
    chrome.permissions.request = async () => false;
    try { return JSON.parse(await pageForge.command('import-repository', JSON.stringify({ url: 'https://github.com/fixture/theme' }))); }
    finally { chrome.permissions.request = request; }
  });
  assert.match(deniedImport.error, /нужен доступ к GitHub/);
  await popup.getByRole('textbox').fill('https://github.com/fixture/theme');
  await popup.screenshot({ path: path.join(diagnostics, 'extension-repository.png'), animations: 'disabled' });
  await popup.getByRole('button', { name: 'Добавить из репозитория', exact: true }).click();
  await popup.getByRole('button', { name: 'Применить Из репозитория', exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Применить Из репозитория', exact: true }).click();
  await site.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(50, 48, 47)');
  await popup.getByRole('button', { name: 'Все', exact: true }).click();
  await popup.getByRole('button', { name: 'Проверить обновления', exact: true }).click();
  await popup.getByRole('button', { name: 'Открыть релиз Из репозитория', exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Открыть релиз PageForge', exact: true }).waitFor();
  const updates = await command('state', { tabId });
  assert.equal(updates.appUpdate.available, true);
  assert.equal(updates.library.find((profile) => profile.id === 'repository').update.version, '1.0.1');
  await popup.screenshot({ path: path.join(diagnostics, 'extension-updates.png'), animations: 'disabled' });
  await worker.evaluate(() => {
    globalThis.__originalCreateTab = chrome.tabs.create;
    chrome.tabs.create = async (options) => { globalThis.__openedRelease = options.url; return { id: -1 }; };
  });
  await popup.getByRole('button', { name: 'Открыть релиз Из репозитория', exact: true }).click();
  assert.equal(await worker.evaluate(() => globalThis.__openedRelease), 'https://github.com/fixture/theme/releases/tag/v1.0.1');
  await worker.evaluate(() => { chrome.tabs.create = globalThis.__originalCreateTab; });
  await popup.getByRole('button', { name: 'Удалить Из репозитория', exact: true }).click();
  await site.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)');
  await popup.getByRole('button', { name: 'К текущему сайту', exact: true }).click();
  const registrations = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  assert.ok(registrations.every((entry) => entry.matches.every((pattern) => !/api\.github|codeload\.github/.test(pattern))));

  const foreign = theme('foreign', 'Другой сайт', 'css', 'body{color:red}', {
    'profile.json': strToU8(JSON.stringify({ schemaVersion: 1, id: 'foreign', name: 'Другой сайт', version: '1.0.0', mode: 'css', matches: ['https://other.example/*'] })),
  });
  assert.equal((await command('import', { tabId, archive: Buffer.from(foreign).toString('base64') })).error, undefined);
  await worker.evaluate(async () => {
    const { selections = {} } = await chrome.storage.local.get('selections');
    selections['https://other.example'] = 'foreign';
    await chrome.storage.local.set({ selections });
    const profile = await PageForgeStore.get('paper');
    profile.preview = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP41yD5H4QZYAwAXfIKWcwh+BsAAAAASUVORK5CYII=';
    profile.previewState = 'ready';
    await PageForgeStore.put(profile);
  });
  const listing = await command('state', { tabId });
  assert.equal(listing.profiles.some((item) => item.id === 'foreign'), false);
  assert.equal(listing.library.find((item) => item.id === 'foreign').compatible, false);
  assert.equal(listing.library.find((item) => item.id === 'foreign').selected, true);
  assert.ok(listing.library.find((item) => item.id === 'paper').preview.startsWith('data:image/png;'));
  await popup.getByRole('button', { name: 'Все', exact: true }).click();
  await popup.getByText('Все оформления', { exact: true }).waitFor();
  const foreignRow = popup.getByRole('group', { name: /^Другой сайт\s+other\.example\s+Выбрано$/ });
  await foreignRow.waitFor();
  await popup.screenshot({ path: path.join(diagnostics, 'extension-library.png'), animations: 'disabled' });
  const foreignFiles = await exportedFiles(tabId, 'foreign', 'other.example.zip');
  assert.equal(JSON.parse(strFromU8(foreignFiles['profile.json'])).id, 'foreign');
  await popup.getByRole('button', { name: 'Удалить Другой сайт', exact: true }).click();
  await foreignRow.waitFor({ state: 'hidden' });
  await popup.getByRole('button', { name: 'К текущему сайту', exact: true }).click();

  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Отображение', exact: true }).click();
  await popup.screenshot({ path: path.join(diagnostics, 'extension.png'), animations: 'disabled' });
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  await command('select', { tabId, id: 'paper', originPattern: 'http://127.0.0.1/*' });
  await context.close();
  await launch();
  const restoredSite = await context.newPage();
  await restoredSite.goto(address);
  await restoredSite.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(251, 241, 199)');
  const stored = await worker.evaluate(() => PageForgeStore.all());
  assert.equal(stored.length, 2);
  const restoredTabId = await worker.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url).id, address);
  await openPopup(restoredTabId);
  await popup.getByRole('button', { name: 'Удалить Бумага', exact: true }).click();
  await restoredSite.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)');
  if (process.env.PAGEFORGE_TEST_REPOSITORY) {
    const imported = await command('import-repository', { tabId: restoredTabId, url: process.env.PAGEFORGE_TEST_REPOSITORY });
    assert.equal(imported.error, undefined);
    const profile = await worker.evaluate((id) => PageForgeStore.get(id), imported.id);
    assert.equal(profile.id, 'github-gruvbox-studio');
    assert.ok(profile.css.includes('#1d2021'));
    assert.ok(profile.files['assets/fonts/NunitoSans-Variable.ttf']);
    assert.equal(profile.repository.url, process.env.PAGEFORGE_TEST_REPOSITORY);
    assert.equal((await command('check-updates')).error, undefined);
    console.log('Оформление загружено из настоящего открытого репозитория GitHub.');
  }
  console.log('Проверены Flutter, CSS, своя разметка, откат после ошибки, ZIP, снимок основы, сохранение после перезапуска и отсутствие внешних запросов интерфейса.');
} catch (error) {
  if (popup && !popup.isClosed()) {
    await popup.screenshot({ path: path.join(diagnostics, 'extension-failure.png'), animations: 'disabled' });
    await writeFile(path.join(diagnostics, 'extension-failure.html'), await popup.content());
  }
  throw error;
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  const resolved = path.resolve(profilePath);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('pageforge-browser-'));
  await rm(resolved, { recursive: true, force: true });
}

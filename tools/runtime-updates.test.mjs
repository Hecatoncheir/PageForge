import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as zip from 'fflate';

globalThis.fflate = zip;
await import('../extension/profiles.js');
await import('../web/repositories.js');
const runtime = await readFile(new URL('../extension/runtime.js', import.meta.url), 'utf8');
const repositoryUrl = 'https://github.com/fixture/theme';
const releaseUrl = `${repositoryUrl}/releases/tag/v1.0.1`;
const archive = (changes = {}, css = 'body{color:#ebdbb2}') => zip.zipSync({
  'profile.json': zip.strToU8(JSON.stringify({ schemaVersion: 1, id: 'theme', name: 'Оформление', version: '1.0.1', mode: 'css', matches: ['https://example.com/*'], ...changes })),
  'styles.css': zip.strToU8(css),
});

function fixture({ download = async () => archive(), permission = true, update = {}, repository = { url: repositoryUrl }, missingTab = false } = {}) {
  const profile = { ...PageForgeProfiles.decodeArchive(archive({ version: '1.0.0' })), repository, previewState: 'ready', preview: 'old-preview' };
  const entries = new Map([['theme', structuredClone(profile)]]);
  const preferences = { selections: { 'https://example.com': 'theme' }, updates: { profiles: { theme: { repositoryUrl, version: '1.0.1', url: releaseUrl, ...update } } } };
  const requests = [];
  const event = { addListener() {} };
  const sandbox = {
    console, URL,
    PageForgeProfiles,
    PageForgeRepositories: { ...PageForgeRepositories, download: async (url) => { requests.push(url); return download(url); } },
    PageForgeStore: {
      get: async (id) => structuredClone(entries.get(id)),
      all: async () => structuredClone([...entries.values()]),
      put: async (value) => entries.set(value.id, structuredClone(value)),
      remove: async (id) => entries.delete(id),
    },
    chrome: {
      runtime: { getManifest: () => ({ version: '0.2.1' }), onInstalled: event },
      permissions: { contains: async () => permission, onAdded: event, onRemoved: event },
      storage: { local: { get: async () => structuredClone(preferences), set: async (value) => Object.assign(preferences, structuredClone(value)) } },
      tabs: { get: async () => { if (missingTab) throw Error('Закрыто'); return { id: 7, url: 'chrome://extensions/', active: true }; }, query: async () => [], onUpdated: event, onActivated: event },
    },
  };
  vm.runInNewContext(runtime, sandbox);
  return { handle: sandbox.PageForgeRuntime.handle, entries, preferences, profile, requests };
}

test('Обновление загружает найденный тег, сохраняет выбор и источник, сбрасывает старое превью', async () => {
  const f = fixture();
  const result = await f.handle('update-profile', { id: 'theme', tabId: 7, url: 'https://evil.example' });
  assert.equal(result.message, 'Оформление обновлено до 1.0.1');
  assert.deepEqual(f.requests, [releaseUrl]);
  const installed = f.entries.get('theme');
  assert.equal(installed.version, '1.0.1');
  assert.equal(installed.repository.url, repositoryUrl);
  assert.equal(installed.preview, null);
  assert.equal(installed.previewState, 'pending');
  assert.equal(f.preferences.selections['https://example.com'], 'theme');
  const state = await f.handle('state', { tabId: 7 });
  assert.equal(state.library[0].selected, true);
  assert.equal(state.library[0].update.available, false);
});

for (const [name, download, message] of [
  ['другой идентификатор', async () => archive({ id: 'other' }), /идентификатор/],
  ['другая версия', async () => archive({ version: '1.0.2' }), /Версия/],
  ['понижение версии', async () => archive({ version: '0.9.0' }), /Версия/],
  ['повреждённый ZIP', async () => new Uint8Array([1, 2, 3]), /./],
  ['недопустимый CSS', async () => archive({}, '@import "https://remote.example/a.css";'), /@import/],
  ['ошибка сети', async () => { throw Error('Нет сети'); }, /Нет сети/],
]) {
  test(`При ошибке «${name}» установленное оформление и выбор сохраняются`, async () => {
    const f = fixture({ download });
    await assert.rejects(f.handle('update-profile', { id: 'theme' }), message);
    assert.deepEqual(f.entries.get('theme'), f.profile);
    assert.equal(f.entries.size, 1);
    assert.equal(f.preferences.selections['https://example.com'], 'theme');
  });
}

for (const [name, options] of [
  ['ZIP без источника', { repository: null }],
  ['чужой источник проверки', { update: { repositoryUrl: 'https://github.com/other/theme' } }],
  ['чужой релиз', { update: { url: 'https://github.com/other/theme/releases/tag/v1.0.1' } }],
  ['ссылка на ветку', { update: { url: `${repositoryUrl}/tree/main` } }],
  ['устаревшая проверка', { update: { version: '1.0.0' } }],
  ['отказ в доступе', { permission: false }],
]) {
  test(`Обновление отклоняется до скачивания: ${name}`, async () => {
    const f = fixture(options);
    await assert.rejects(f.handle('update-profile', { id: 'theme' }));
    assert.deepEqual(f.requests, []);
    assert.deepEqual(f.entries.get('theme'), f.profile);
  });
}

test('Закрытие вкладки не прерывает установку оформления из общего списка', async () => {
  const f = fixture({ missingTab: true });
  await f.handle('update-profile', { id: 'theme', tabId: 7 });
  assert.equal(f.entries.get('theme').version, '1.0.1');
});

test('Удалённое во время загрузки оформление не появляется заново', async () => {
  let release;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  const f = fixture({ download: () => { started(); return new Promise((resolve) => { release = resolve; }); } });
  const task = f.handle('update-profile', { id: 'theme' });
  await entered;
  await f.handle('delete', { id: 'theme' });
  release(archive());
  await assert.rejects(task, /изменилось/);
  assert.equal(f.entries.has('theme'), false);
  assert.equal(f.preferences.selections['https://example.com'], null);
});

test('Позднее обновление не перезаписывает оформление, заменённое в другом окне', async () => {
  let release;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  const f = fixture({ download: () => { started(); return new Promise((resolve) => { release = resolve; }); } });
  const task = f.handle('update-profile', { id: 'theme' });
  await entered;
  await f.handle('import', { archive: archive({ version: '1.0.2' }), tabId: 7 });
  release(archive());
  await assert.rejects(task, /изменилось/);
  assert.equal(f.entries.get('theme').version, '1.0.2');
});

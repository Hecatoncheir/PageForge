import test from 'node:test';
import assert from 'node:assert/strict';
import * as zip from 'fflate';

globalThis.fflate = zip;
await import('../extension/profiles.js');
await import('../web/repositories.js');
const repositories = globalThis.PageForgeRepositories;
const manifest = { schemaVersion: 1, id: 'repo-test', name: 'Из репозитория', version: '1.0.0', mode: 'css', matches: ['https://github.com/*'] };
const archive = (extra = {}) => zip.zipSync({
  'repo-sha/profile.json': zip.strToU8(JSON.stringify(manifest)),
  'repo-sha/styles.css': zip.strToU8('body { color: #ebdbb2; }'),
  ...extra,
});

test('Ссылки GitHub преобразуются в адрес архива, включая ветки и .git', () => {
  for (const value of ['https://github.com/owner/repo', 'https://github.com/owner/repo.git/']) {
    assert.equal(repositories.source(value).archiveUrl, 'https://api.github.com/repos/owner/repo/zipball/HEAD');
  }
  assert.match(repositories.source('https://github.com/owner/repo/tree/feature/theme').archiveUrl, /zipball\/feature%2Ftheme$/);
  assert.match(repositories.source('https://github.com/owner/repo/releases/tag/v1.0.0').archiveUrl, /zipball\/v1\.0\.0$/);
  for (const value of ['http://github.com/a/b', 'https://evil.example/a/b', 'https://github.com@evil.example/a/b', 'https://user:secret@github.com/a/b', 'https://github.com/a/b?token=x', 'https://github.com/a/b/issues', 'https://github.com/a/b/tree/']) {
    assert.throws(() => repositories.source(value));
  }
});

test('Проверка релизов сравнивает числовые версии и пропускает черновики и незавершённые пакеты', async () => {
  assert.equal(repositories.newer('1.10.0', '1.9.9'), true);
  for (const current of ['1.10.0', '2.0.0']) assert.equal(repositories.newer('v1.10.0', current), false);
  assert.equal(repositories.newer('bad', '1.0.0'), false);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const response = new Response(JSON.stringify([
        { tag_name: 'v9.0.0', draft: true, published_at: '2030-01-01T00:00:00Z' },
        { tag_name: 'v2.0.0', draft: false, published_at: '2029-01-01T00:00:00Z', assets: [] },
        { tag_name: 'v1.10.0', draft: false, prerelease: true, published_at: '2028-01-01T00:00:00Z', assets: ['chrome', 'firefox'].map((browser) => ({ name: `pageforge-${browser}-1.10.0.zip`, state: 'uploaded' })) },
      ]));
      Object.defineProperty(response, 'url', { value: url });
      return response;
    };
    const app = await repositories.latestRelease('https://github.com/owner/repo', true);
    assert.equal(app.version, '1.10.0');
    assert.equal(app.url, 'https://github.com/owner/repo/releases/tag/v1.10.0');
    assert.equal((await repositories.latestRelease('https://github.com/owner/repo')).version, '2.0.0');
  } finally { globalThis.fetch = originalFetch; }
});

test('Из репозитория берутся только файлы оформления без снимков и служебных файлов', () => {
  const result = repositories.unpack(archive({
    'repo-sha/README.md': zip.strToU8('Инструкция'),
    'repo-sha/reference/page.html': zip.strToU8('Личные данные'),
    'repo-sha/.github/workflows/ci.yml': zip.strToU8('name: CI'),
    'repo-sha/tools/build.js': zip.strToU8('throw Error()'),
    'repo-sha/assets/icon.svg': zip.strToU8('<svg/>'),
  }));
  const profile = PageForgeProfiles.decodeArchive(result);
  assert.equal(profile.id, 'repo-test');
  assert.deepEqual(Object.keys(profile.files).sort(), ['README.md', 'assets/icon.svg', 'profile.json', 'styles.css']);
});

test('Вложенное оформление, опасные ресурсы и чрезмерный распакованный размер отклоняются', () => {
  assert.throws(() => repositories.unpack(zip.zipSync({ 'repo/theme/profile.json': zip.strToU8('{}') })), /В корне/);
  assert.throws(() => repositories.unpack(archive({ 'repo-sha/assets/script.js': zip.strToU8('x') })), /Исполняемые/);
  assert.throws(() => repositories.unpack(archive({ 'repo-sha/../escape': zip.strToU8('x') })), /Недопустимый путь/);
  assert.throws(() => repositories.unpack(archive({ 'repo-sha/large': new Uint8Array(PageForgeProfiles.LIMITS.expanded + 1) })), /слишком много/);
});

test('Загрузка проверяет ответы сервера, ограничивает поток и не отправляет учётные данные', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      const response = new Response(archive());
      Object.defineProperty(response, 'url', { value: url });
      return response;
    };
    assert.equal(PageForgeProfiles.decodeArchive(await repositories.download('https://github.com/owner/repo')).id, 'repo-test');
    globalThis.fetch = async () => new Response('', { status: 404 });
    await assert.rejects(repositories.download('https://github.com/owner/repo'), /не найдены/);
    globalThis.fetch = async () => new Response('', { status: 403 });
    await assert.rejects(repositories.download('https://github.com/owner/repo'), /ограничил/);
    await assert.rejects(repositories.readArchive(new Response(new Uint8Array(PageForgeProfiles.LIMITS.archive + 1))), /8 МБ/);
  } finally { globalThis.fetch = originalFetch; }
});

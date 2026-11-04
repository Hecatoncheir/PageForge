import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../extension/downloads.js', import.meta.url), 'utf8');

function browser({ determining = true } = {}) {
  let listener;
  let options;
  const chrome = {
    runtime: { id: 'pageforge-test' },
    downloads: {
      download: async (value) => { options = value; return 42; },
      ...(determining ? { onDeterminingFilename: { addListener: (value) => { listener = value; } } } : {}),
    },
  };
  const context = { chrome };
  runInNewContext(source, context);
  return {
    save: context.PageForgeDownloads.save,
    options: () => options,
    suggest: (item) => {
      const calls = [];
      listener(item, (value) => calls.push(value));
      return structuredClone(calls);
    },
  };
}

test('Выгрузка передаёт имя домена и сохраняет ZIP в URL', async () => {
  const api = browser();
  assert.equal(await api.save('github.com.zip', 'UEs='), 42);
  assert.equal(api.options().filename, 'github.com.zip');
  assert.equal(api.options().url, 'data:application/zip;pageforge-name=github.com.zip;base64,UEs=');
  assert.equal(api.options().conflictAction, 'uniquify');
});

test('Chrome получает исходное имя вместо повторно определённого имени файла', async () => {
  const api = browser();
  await api.save('github.com.zip', 'UEs=');
  assert.deepEqual(api.suggest({ byExtensionId: 'pageforge-test', url: api.options().url, filename: 'Без названия.zip' }), [
    { filename: 'github.com.zip', conflictAction: 'uniquify' },
  ]);
  const restarted = browser();
  assert.deepEqual(restarted.suggest({ byExtensionId: 'pageforge-test', url: api.options().url }), [
    { filename: 'github.com.zip', conflictAction: 'uniquify' },
  ]);
});

test('Чужие загрузки и небезопасные имена не переименовываются', () => {
  const api = browser();
  for (const item of [
    { byExtensionId: 'other', url: 'data:application/zip;pageforge-name=github.com.zip;base64,UEs=' },
    { byExtensionId: 'pageforge-test', url: 'https://example.com/archive.zip' },
    { byExtensionId: 'pageforge-test', url: 'data:application/zip;pageforge-name=../file.zip;base64,UEs=' },
  ]) assert.deepEqual(api.suggest(item), [undefined]);
});

test('В браузере без onDeterminingFilename имя передаётся через download', async () => {
  const api = browser({ determining: false });
  await api.save('example.com.zip', 'UEs=');
  assert.equal(api.options().filename, 'example.com.zip');
  await assert.rejects(api.save('../bad.zip', 'UEs='), /Недопустимое имя ZIP/);
});

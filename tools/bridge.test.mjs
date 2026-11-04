import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../web/bridge.js', import.meta.url), 'utf8');
await import('../web/repositories.js');

function bridge(request = async () => true) {
  const calls = [];
  const sandbox = {
    URLSearchParams,
    location: { search: '?tab=7' },
    document: { createElement: () => ({}), body: { append() {} }, addEventListener() {} },
    PageForgeRepositories,
    chrome: {
      runtime: { id: 'test', sendMessage: async (message) => { calls.push(message); return { data: { message: 'Готово' } }; } },
      permissions: { request },
    },
  };
  vm.runInNewContext(source, sandbox);
  return { api: sandbox.pageForge, calls };
}

for (const [command, args, origins] of [
  ['select', { id: 'theme', originPattern: 'https://example.com/*' }, ['https://example.com/*']],
  ['import-repository', { url: 'https://github.com/owner/repo' }, PageForgeRepositories.origins],
  ['update-profile', { id: 'theme' }, PageForgeRepositories.origins],
  ['check-updates', {}, ['https://api.github.com/*']],
]) {
  test(`Запрос разрешения ${command} начинается в том же вызове, что действие пользователя`, async () => {
    let requested;
    const { api, calls } = bridge((permission) => { requested = permission; return Promise.resolve(true); });
    const response = api.command(command, JSON.stringify(args));
    assert.deepEqual(Array.from(requested.origins), origins);
    assert.equal(calls.length, 0);
    assert.equal(JSON.parse(await response).message, 'Готово');
    assert.equal(calls[0].args.tabId, 7);
  });
}

test('Отказ в разрешении не передаёт команду фоновому обработчику', async () => {
  const { api, calls } = bridge(async () => false);
  const response = JSON.parse(await api.command('select', JSON.stringify({ id: 'theme', originPattern: 'https://example.com/*' })));
  assert.equal(response.error, 'Доступ к сайту не предоставлен');
  assert.equal(calls.length, 0);
});

test('Неверная ссылка отклоняется до запроса разрешений', async () => {
  let requested = false;
  const { api, calls } = bridge(async () => { requested = true; return true; });
  const response = JSON.parse(await api.command('import-repository', JSON.stringify({ url: 'https://evil.example/owner/repo' })));
  assert.ok(response.error);
  assert.equal(requested, false);
  assert.equal(calls.length, 0);
});

test('Отказ в доступе к GitHub не запускает обновление оформления', async () => {
  const { api, calls } = bridge(async () => false);
  const response = JSON.parse(await api.command('update-profile', JSON.stringify({ id: 'theme' })));
  assert.equal(response.error, 'Для обновления оформления нужен доступ к GitHub');
  assert.equal(calls.length, 0);
});

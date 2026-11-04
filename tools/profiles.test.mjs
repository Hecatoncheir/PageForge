import test from 'node:test';
import assert from 'node:assert/strict';
import * as zip from 'fflate';

globalThis.fflate = zip;
await import('../extension/profiles.js');
const profiles = globalThis.PageForgeProfiles;
const manifest = { schemaVersion: 1, id: 'paper', name: 'Бумага', version: '1.0.0', mode: 'css', matches: ['https://example.com/*'] };
const archive = (extra = {}, metadata = manifest) => zip.zipSync({
  'profile.json': zip.strToU8(JSON.stringify(metadata)),
  'styles.css': zip.strToU8('body { background: #fbf1c7; }'),
  ...extra,
});

test('Правила адресов различают протоколы, домены и пути', () => {
  assert.ok(profiles.matches(['https://*.example.com/articles/*'], 'https://sub.example.com/articles/one'));
  assert.ok(profiles.matches(['http://127.0.0.1/*'], 'http://127.0.0.1:4173/page'));
  assert.equal(profiles.matches(['https://*.example.com/*'], 'https://otherexample.com/'), false);
  assert.equal(profiles.matches(['https://example.com/*'], 'http://example.com/'), false);
  assert.equal(profiles.matches(['https://example.com/a*'], 'https://example.com/b'), false);
  assert.equal(profiles.matches(['https://example.com/*'], 'chrome://extensions'), false);
});

test('ZIP сохраняет ресурсы и справочные файлы при повторной выгрузке', () => {
  const image = new Uint8Array([1, 2, 3, 4]);
  const input = archive({ 'assets/picture.png': image, 'reference/note.txt': zip.strToU8('Справка') });
  const profile = profiles.decodeArchive(input);
  const output = zip.unzipSync(profiles.encodeArchive(profile));
  assert.deepEqual(output['assets/picture.png'], image);
  assert.equal(zip.strFromU8(output['reference/note.txt']), 'Справка');
  assert.equal(JSON.parse(zip.strFromU8(output['profile.json'])).name, 'Бумага');
});

test('Повреждённые форматы, исполняемые файлы и выход из папки отклоняются', () => {
  for (const files of [
    { '../escape.txt': zip.strToU8('x') },
    { 'assets/script.js': zip.strToU8('alert(1)') },
    { 'rules.json': zip.strToU8('{"bindings":[{"kind":"eval"}]}') },
  ]) assert.throws(() => profiles.decodeArchive(archive(files)));
  assert.throws(() => profiles.decodeArchive(archive({}, { ...manifest, schemaVersion: 99 })));
  assert.throws(() => profiles.decodeArchive(archive({}, { ...manifest, mode: 'layout' })));
});

test('Архив с чрезмерным распакованным размером отклоняется до распаковки', () => {
  const input = archive({ 'assets/large.bin': new Uint8Array(profiles.LIMITS.expanded + 1) });
  assert.throws(() => profiles.decodeArchive(input), /слишком много данных/);
});

test('Ресурсы CSS встраиваются локально, внешние импорты отклоняются', () => {
  const profile = profiles.decodeArchive(archive({ 'assets/picture.png': new Uint8Array([1, 2]) }));
  profile.css = 'body { background: url("assets/picture.png"); }';
  assert.match(profiles.payload(profile).css, /data:image\/png;base64,AQI=/);
  for (const css of ['@import "https://remote.example/x.css";', 'body { background: url(https://remote.example/a.png); }', '@i\\6d port "x.css";']) {
    assert.throws(() => profiles.payload({ ...profile, css }));
  }
});

test('Основа содержит разметку, стили и правила без адресных параметров', () => {
  const profile = profiles.starter('https://example.com/private?token=secret', { html: '<main>Текст</main>', css: 'body {}', computed: [] });
  assert.deepEqual(profile.matches, ['https://example.com/*']);
  const files = zip.unzipSync(profiles.encodeArchive(profile));
  for (const name of ['profile.json', 'styles.css', 'rules.json', 'layout.html', 'reference/page.html', 'reference/styles.css', 'reference/computed.json']) assert.ok(files[name]);
});

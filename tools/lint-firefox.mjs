import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const result = JSON.parse(execFileSync(process.execPath, [
  path.resolve('node_modules/web-ext/bin/web-ext.js'),
  'lint', '--source-dir', 'dist/firefox', '--output', 'json',
], { encoding: 'utf8' }));

const contentLines = readFileSync('dist/firefox/content.js', 'utf8').split(/\r?\n/);
function isInertTemplateParsing(warning) {
  // Разбирается инертный template. В документ попадают новые узлы,
  // созданные clean() по списку разрешённых тегов и атрибутов.
  return warning.code === 'UNSAFE_VAR_ASSIGNMENT'
    && warning.message === 'Unsafe assignment to innerHTML'
    && warning.file === 'content.js'
    && contentLines[warning.line - 1]?.trim() === 'parsed.innerHTML = payload.template;';
}

// Кроме разбора инертного шаблона, Flutter использует динамический import
// для локальных файлов движка. Другие предупреждения остаются ошибкой.
const unexpectedWarnings = result.warnings.filter((warning) => !(
  isInertTemplateParsing(warning) || (warning.code === 'UNSAFE_VAR_ASSIGNMENT'
  && warning.message === 'Unsafe call to import for argument 0'
  && ['flutter_bootstrap.js', 'main.dart.js'].includes(warning.file))
));
assert.deepEqual(result.errors, [], 'Ошибки пакета Firefox');
assert.deepEqual(unexpectedWarnings, [], 'Новые предупреждения пакета Firefox');
console.log(JSON.stringify(result.summary));
console.log(`Проверены предупреждения о локальном import Flutter и разборе инертного шаблона: ${result.warnings.length}`);

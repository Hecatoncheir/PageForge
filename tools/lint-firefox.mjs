import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const result = JSON.parse(execFileSync(process.execPath, [
  path.resolve('node_modules/web-ext/bin/web-ext.js'),
  'lint', '--source-dir', 'dist/firefox', '--output', 'json',
], { encoding: 'utf8' }));

// Flutter использует динамический import для локальных файлов движка.
// Разрешено только это предупреждение в двух сгенерированных файлах.
const unexpectedWarnings = result.warnings.filter((warning) => !(
  warning.code === 'UNSAFE_VAR_ASSIGNMENT'
  && warning.message === 'Unsafe call to import for argument 0'
  && ['flutter_bootstrap.js', 'main.dart.js'].includes(warning.file)
));
assert.deepEqual(result.errors, [], 'Ошибки пакета Firefox');
assert.deepEqual(unexpectedWarnings, [], 'Новые предупреждения пакета Firefox');
console.log(JSON.stringify(result.summary));
console.log(`Учтено предупреждений о локальном import в коде Flutter: ${result.warnings.length}`);

"""Проверить сложность собственного Dart/JS-кода закреплённым анализатором."""

import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work' / 'complexity'
PINS = json.loads((ROOT / 'tools' / 'complexity' / 'pins.json').read_text())


def run(arguments, **options):
    return subprocess.run(arguments, check=True, **options)


def checkout(path, pin):
    if not (path / '.git').exists():
        run(['git', 'init', '-q', str(path)])
        run(['git', '-C', str(path), 'remote', 'add', 'origin', pin['url']])
        run(['git', '-C', str(path), 'fetch', '-q', '--depth', '1', 'origin', pin['revision']])
        run(['git', '-C', str(path), 'checkout', '-q', 'FETCH_HEAD'])
    actual = subprocess.check_output(['git', '-C', str(path), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != pin['revision']:
        raise RuntimeError(f'Версия {path.name} отличается от pins.json. Используйте пустую папку кэша.')
    if subprocess.check_output(['git', '-C', str(path), 'status', '--porcelain'], text=True).strip():
        raise RuntimeError(f'Исходники {path.name} изменены: нужен чистый кэш.')


def windows_compiler(arguments, language):
    if shutil.which('cl'):
        run(['cl', *arguments], cwd=WORK)
        return
    installer = Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'))
    finder = installer / 'Microsoft Visual Studio' / 'Installer' / 'vswhere.exe'
    environment = subprocess.check_output([
        str(finder), '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-find', 'Common7/Tools/VsDevCmd.bat',
    ], text=True).strip()
    if not environment:
        raise RuntimeError('Нужны средства сборки Visual Studio с компилятором C++.')
    batch = WORK / f'build-{language}.cmd'
    command = subprocess.list2cmdline(['cl', *arguments])
    batch.write_text(f'@echo off\ncall "{environment}" -arch=x64 -host_arch=x64\nif errorlevel 1 exit /b 1\n{command}\nexit /b %errorlevel%\n', encoding='utf-8')
    run([os.environ['COMSPEC'], '/d', '/c', str(batch)], cwd=WORK)


def build_parser(language):
    pin = PINS[language]
    source = WORK / language
    checkout(source, pin)
    output = WORK / 'parser' / f'{language}.so'
    stamp = WORK / f'{language}.revision'
    if output.exists() and stamp.exists() and stamp.read_text() == pin['revision']:
        return
    files = [source / 'src' / 'parser.c']
    files.extend(path for path in (source / 'src').glob('scanner.c*') if path.suffix in ('.c', '.cc'))
    if os.name == 'nt':
        windows_compiler(['/nologo', '/LD', '/O2', '/utf-8', f'/I{source / "src"}', *map(str, files), '/link', f'/OUT:{output}'], language)
    else:
        run(['cc', '-shared', '-fPIC', '-O2', f'-I{source / "src"}', *map(str, files), '-o', str(output)])
    stamp.write_text(pin['revision'])


def main():
    nvim = shutil.which('nvim')
    if not nvim:
        raise RuntimeError('Установите Neovim 0.11+ и добавьте nvim в PATH.')
    (WORK / 'parser').mkdir(parents=True, exist_ok=True)
    checkout(ROOT / 'work' / 'complexity-tool', PINS['analyzer'])
    for language in ('dart', 'javascript'):
        build_parser(language)
    run([nvim, '--headless', '-u', 'NONE', '-l', 'tools/complexity/check.lua'], cwd=ROOT)


if __name__ == '__main__':
    main()

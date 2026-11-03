"""Сборка Flutter и подготовка пакетов расширения без сторонних Python-зависимостей."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BROWSERS = ("chrome", "edge", "firefox")


def normalize_version(value):
    version = value.removeprefix("v")
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
        raise ValueError("Версия должна иметь вид v1.2.3 или 1.2.3")
    parts = [int(part) for part in version.split(".")]
    if max(parts) > 65535 or not any(parts):
        raise ValueError("Компоненты версии: 0–65535; версия 0.0.0 недопустима")
    return version


def project_version(root=ROOT):
    pubspec = (root / "pubspec.yaml").read_text(encoding="utf-8")
    match = re.search(r"^version:\s*([^+\s]+)", pubspec, re.MULTILINE)
    if not match:
        raise ValueError("В pubspec.yaml не указана версия")
    return normalize_version(match[1])


def browser_manifest(base, browser, version):
    manifest = {**base, "version": normalize_version(version)}
    if browser == "firefox":
        manifest["background"] = {"scripts": ["background.js"]}
        manifest["browser_specific_settings"] = {
            "gecko_android": {"strict_min_version": "142.0"},
            "gecko": {
                "id": "pageforge@hecatoncheir.github.io",
                "strict_min_version": "140.0",
                "data_collection_permissions": {"required": ["none"]},
            }
        }
    elif browser in ("chrome", "edge"):
        manifest["background"] = {"service_worker": "background.js"}
        manifest["minimum_chrome_version"] = "120"
    else:
        raise ValueError(f"Неизвестный браузер: {browser}")
    return manifest


def reset_output(root, name):
    target = root / name
    if name not in ("dist", "release") or target.is_symlink():
        raise ValueError("Недопустимая папка сборки")
    if target.resolve().parent != root.resolve():
        raise ValueError("Папка сборки находится вне проекта")
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
    return target


def make_zip(source, destination):
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if not path.is_file():
                continue
            info = zipfile.ZipInfo(path.relative_to(source).as_posix(), (2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())


def package_extensions(root, version):
    web = root / "build" / "web"
    required = (
        "index.html", "main.dart.js", "flutter_bootstrap.js", "bridge.js",
        "canvaskit/canvaskit.js", "canvaskit/canvaskit.wasm",
        "assets/assets/fonts/Roboto-Regular.ttf",
    )
    for filename in required:
        if not (web / filename).is_file():
            raise ValueError(f"Отсутствует файл Flutter-сборки: {filename}")
    base = json.loads((root / "extension" / "manifest.json").read_text(encoding="utf-8"))
    dist = reset_output(root, "dist")
    release = reset_output(root, "release")
    checksums = []
    for browser in BROWSERS:
        target = dist / browser
        target.mkdir()
        for path in sorted(web.rglob("*")):
            relative = path.relative_to(web)
            if not path.is_file():
                continue
            if relative.parts[0] == "canvaskit" and relative.as_posix() not in (
                "canvaskit/canvaskit.js", "canvaskit/canvaskit.wasm",
            ):
                continue
            if path.name in ("flutter_service_worker.js", "flutter.js", ".last_build_id"):
                continue
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)
        shutil.copyfile(root / "extension" / "background.js", target / "background.js")
        shutil.copytree(root / "extension" / "icons", target / "icons")
        shutil.copyfile(root / "assets" / "fonts" / "LICENSE.txt", target / "ROBOTO-LICENSE.txt")
        manifest = browser_manifest(base, browser, version)
        (target / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        archive = release / f"pageforge-{browser}-{version}.zip"
        make_zip(target, archive)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksums.append(f"{digest}  {archive.name}")
        print(archive.name)
    (release / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=os.environ.get("RELEASE_TAG") or None)
    args = parser.parse_args()
    version = normalize_version(args.version) if args.version else project_version()
    flutter = shutil.which("flutter")
    if not flutter:
        raise SystemExit("Flutter не найден. Установите версию из .flutter-version")
    subprocess.run(
        [flutter, "build", "web", "--release", "--csp", "--no-web-resources-cdn",
         "--no-wasm-dry-run", f"--build-name={version}",
         f"--dart-define=PAGEFORGE_VERSION={version}"],
        cwd=ROOT, check=True,
    )
    package_extensions(ROOT, version)


if __name__ == "__main__":
    main()


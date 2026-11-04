"""Проверки браузерных манифестов и структуры готовых пакетов."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from build import BROWSERS, browser_manifest, normalize_version, package_extensions


class BuildTests(unittest.TestCase):
    def test_version_rejects_tags_that_browsers_cannot_install(self):
        self.assertEqual(normalize_version("v1.2.3"), "1.2.3")
        for value in ("0.0.0", "1.2", "01.2.3", "65536.0.0", "1.2.3-beta.1", "v1.2.3/../x"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_version(value)

    def test_background_is_compatible_with_each_browser(self):
        base = {"manifest_version": 3}
        for browser in ("chrome", "edge"):
            manifest = browser_manifest(base, browser, "1.2.3")
            self.assertEqual(manifest["background"], {"service_worker": "background.js"})
            self.assertNotIn("browser_specific_settings", manifest)
        firefox = browser_manifest(base, "firefox", "1.2.3")
        self.assertIn("background.js", firefox["background"]["scripts"])
        self.assertNotIn("service_worker", firefox["background"])
        self.assertIn("id", firefox["browser_specific_settings"]["gecko"])
        self.assertNotIn("background", base)

    def test_packages_have_root_manifest_versions_and_valid_checksums(self):
        with tempfile.TemporaryDirectory(prefix="pageforge-build-") as temporary:
            root = Path(temporary)
            for name in (
                "index.html", "main.dart.js", "flutter_bootstrap.js", "bridge.js",
                "canvaskit/canvaskit.js", "canvaskit/canvaskit.wasm",
                "assets/design/assets/fonts/NunitoSans-Variable.ttf", "canvaskit/chromium/canvaskit.wasm",
                "flutter_service_worker.js",
            ):
                path = root / "build" / "web" / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture", encoding="utf-8")
            (root / "extension" / "icons").mkdir(parents=True)
            (root / "extension" / "icons" / "icon-16.png").write_bytes(b"fixture")
            (root / "extension" / "background.js").write_text("fixture", encoding="utf-8")
            (root / "extension" / "manifest.json").write_text('{"manifest_version":3}', encoding="utf-8")
            (root / "design" / "assets" / "fonts").mkdir(parents=True)
            (root / "design" / "assets" / "fonts" / "Nunito-OFL.txt").write_text("fixture", encoding="utf-8")
            (root / "design" / "assets" / "vendor").mkdir()
            for name in ("fflate.js", "fflate-LICENSE.txt"):
                (root / "design" / "assets" / "vendor" / name).write_text("fixture", encoding="utf-8")
            package_extensions(root, "2.3.4")
            first = {path.name: path.read_bytes() for path in (root / "release").iterdir()}
            package_extensions(root, "2.3.4")
            second = {path.name: path.read_bytes() for path in (root / "release").iterdir()}
            self.assertEqual(first, second)
            for browser in BROWSERS:
                archive = root / "release" / f"pageforge-{browser}-2.3.4.zip"
                with zipfile.ZipFile(archive) as package:
                    self.assertIsNone(package.testzip())
                    self.assertEqual(json.loads(package.read("manifest.json"))["version"], "2.3.4")
                    self.assertIn("background.js", package.namelist())
                    self.assertIn("canvaskit/canvaskit.wasm", package.namelist())
                    self.assertNotIn("flutter_service_worker.js", package.namelist())
                    self.assertNotIn("canvaskit/chromium/canvaskit.wasm", package.namelist())
            for line in (root / "release" / "SHA256SUMS.txt").read_text().splitlines():
                digest, filename = line.split("  ")
                self.assertEqual(digest, hashlib.sha256((root / "release" / filename).read_bytes()).hexdigest())

    def test_missing_flutter_build_does_not_clear_existing_packages(self):
        with tempfile.TemporaryDirectory(prefix="pageforge-build-") as temporary:
            root = Path(temporary)
            (root / "release").mkdir()
            sentinel = root / "release" / "previous.zip"
            sentinel.write_bytes(b"previous")
            with self.assertRaises(ValueError):
                package_extensions(root, "1.2.3")
            self.assertTrue(sentinel.exists())


if __name__ == "__main__":
    unittest.main()


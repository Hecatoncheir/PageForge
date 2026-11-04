"""Подготовить только публичную страницу, без локальных прототипов."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def package_site():
    source = ROOT / "design"
    output = ROOT / "site-dist"
    output.mkdir(exist_ok=True)
    for name in ("index.html", "site.css", "site.js", "tokens.css", "shared.js"):
        shutil.copyfile(source / name, output / name)
    assets = output / "assets"
    assets.mkdir(exist_ok=True)
    for name in ("marks.svg", "icons.svg", "app-icon.svg"):
        shutil.copyfile(source / "assets" / name, assets / name)
    shutil.copytree(source / "assets" / "fonts", assets / "fonts", dirs_exist_ok=True)
    for name in ("prototype.html", "prototype.js", "prototype.css", "brand.html"):
        if (output / name).exists():
            raise RuntimeError("В публичной папке обнаружен локальный прототип")
    print("Публичная страница подготовлена в site-dist; локальные прототипы исключены.")


if __name__ == "__main__":
    package_site()

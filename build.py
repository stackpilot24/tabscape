"""Package the extension into .dist/customizable-tab-<version>.zip for the Chrome Web Store.

Usage:
  python build.py                # zip current version
  python build.py --bump patch   # bump 1.1.0 -> 1.1.1 in manifest.json, then zip (also: minor, major)
"""
import argparse, json, pathlib, zipfile

ROOT = pathlib.Path(__file__).parent
FILES = ["manifest.json", "*.html", "*.css", "*.js", "icons/*.png"]

ap = argparse.ArgumentParser()
ap.add_argument("--bump", choices=["patch", "minor", "major"])
args = ap.parse_args()

manifest_path = ROOT / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if args.bump:
    major, minor, patch = map(int, manifest["version"].split("."))
    major, minor, patch = {"major": (major + 1, 0, 0), "minor": (major, minor + 1, 0), "patch": (major, minor, patch + 1)}[args.bump]
    manifest["version"] = f"{major}.{minor}.{patch}"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

out = ROOT / ".dist" / f"customizable-tab-{manifest['version']}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for pattern in FILES:
        for f in sorted(ROOT.glob(pattern)):
            z.write(f, f.relative_to(ROOT).as_posix())
print(f"Built {out} ({out.stat().st_size // 1024} KB)")

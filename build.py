"""Package the extension.

Usage:
  python build.py                    # Chrome / Edge / Opera  -> .dist/customizable-tab-<version>.zip
  python build.py --target firefox   # Firefox (AMO)          -> .dist/customizable-tab-<version>-firefox.zip
  python build.py --target demo      # static web demo        -> .dist/demo/ (ready for GitHub Pages)
  python build.py --target all       # all of the above
  python build.py --bump patch       # bump 1.3.0 -> 1.3.1 in manifest.json first (also: minor, major)
"""
import argparse, json, pathlib, shutil, zipfile

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / ".dist"
FILES = ["*.html", "*.css", "*.js", "icons/*.png", "_locales/*/messages.json"]
GECKO_ID = "{6b0f4d2e-9a3c-4c1e-8f57-2d6a1b9e3c41}"
STUB_TAG = '<script src="dev/chrome-stub.js"></script>\n  '

ap = argparse.ArgumentParser()
ap.add_argument("--bump", choices=["patch", "minor", "major"])
ap.add_argument("--target", choices=["chrome", "firefox", "demo", "all"], default="chrome")
args = ap.parse_args()

manifest_path = ROOT / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if args.bump:
    major, minor, patch = map(int, manifest["version"].split("."))
    major, minor, patch = {"major": (major + 1, 0, 0), "minor": (major, minor + 1, 0), "patch": (major, minor, patch + 1)}[args.bump]
    manifest["version"] = f"{major}.{minor}.{patch}"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
version = manifest["version"]


def sources():
    for pattern in FILES:
        for f in sorted(ROOT.glob(pattern)):
            if f.name != "dev.py":
                yield f


def write_zip(out, manifest_obj):
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest_obj, indent=2, ensure_ascii=False))
        for f in sources():
            z.write(f, f.relative_to(ROOT).as_posix())
    print(f"Built {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


def build_chrome():
    write_zip(DIST / f"customizable-tab-{version}.zip", manifest)


def build_firefox():
    # Firefox runs MV3 backgrounds as event pages (scripts), not service workers
    m = json.loads(json.dumps(manifest))
    m["background"] = {"scripts": ["apps.js", "shared.js", "background.js"]}
    m["browser_specific_settings"] = {"gecko": {"id": GECKO_ID, "strict_min_version": "128.0"}}
    write_zip(DIST / f"customizable-tab-{version}-firefox.zip", m)


def build_demo():
    # The pages with a localStorage stand-in for chrome.*, so anyone can try it in a browser
    out = DIST / "demo"
    shutil.rmtree(out, ignore_errors=True)
    for f in sources():
        dest = out / f.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if f.suffix == ".html":
            dest.write_text(f.read_text(encoding="utf-8").replace('<script src="apps.js">', STUB_TAG + '<script src="apps.js">', 1), encoding="utf-8")
        else:
            shutil.copy2(f, dest)
    (out / "dev").mkdir(exist_ok=True)
    shutil.copy2(ROOT / "dev" / "chrome-stub.js", out / "dev" / "chrome-stub.js")
    (out / "index.html").write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=newtab.html"><title>Customizable TAB demo</title>', encoding="utf-8")
    print(f"Built {out.relative_to(ROOT)}/ (open index.html via any static host)")


targets = ["chrome", "firefox", "demo"] if args.target == "all" else [args.target]
for t in targets:
    {"chrome": build_chrome, "firefox": build_firefox, "demo": build_demo}[t]()

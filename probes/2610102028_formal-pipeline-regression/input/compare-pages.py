"""Render two Word PDFs with the same Poppler and compare their page pixels."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from PIL import Image, ImageChops

baseline, current, poppler, output = map(Path, sys.argv[1:])
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
folders = []
for label, pdf in (("baseline-pages", baseline), ("pages", current)):
    dest = output / label
    dest.mkdir(exist_ok=False)
    subprocess.run([str(poppler / "pdftoppm.exe"), "-png", "-r", "110", str(pdf), str(dest / "page")],
                   check=True, capture_output=True)
    folders.append(sorted(dest.glob("page-*.png")))
results = []
for left, right in zip(*folders):
    with Image.open(left) as a, Image.open(right) as b:
        same = a.size == b.size and ImageChops.difference(a.convert("RGB"), b.convert("RGB")).getbbox() is None
    results.append(dict(page=right.name, pixelIdentical=same))
record = dict(baselinePdfSha256=sha(baseline), currentPdfSha256=sha(current),
              renderer=str(poppler / "pdftoppm.exe"), dpi=110,
              baselinePages=len(folders[0]), currentPages=len(folders[1]), pages=results,
              visualReview="not_performed")
passed = len(folders[0]) == len(folders[1]) == 12 and all(x["pixelIdentical"] for x in results)
record["status"] = "passed" if passed else "failed"
(output / "pixel-comparison.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
if not passed:
    raise SystemExit("Pixel regression failed; inspect the rendered pages.")
print("All 12 pages are pixel-identical. Human visual review is still required.")

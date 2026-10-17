"""Reproduce the frozen formal pipeline with an actual workspace-local venv."""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import uuid
import venv

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CHILD_ENV = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
# Do not allow an inherited source path to redirect the installed frozen engine.
CHILD_ENV.pop("PYTHONPATH", None)
CHILD_ENV.pop("PYTHONHOME", None)
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_archive(manifest):
    checked = 0
    for item in manifest["inputFiles"]:
        file = HERE / item["path"]
        if not file.is_file() or sha(file) != item["sha256"]:
            raise RuntimeError(f"Frozen input missing or changed: {file}")
        checked += 1
    for item in manifest["originalFiles"]:
        if item["archive"]:
            file = HERE / item["archive"]
            if not file.is_file() or sha(file) != item["sha256"]:
                raise RuntimeError(f"Archived evidence missing or changed: {file}")
            checked += 1
    if sha(HERE / "requirements.txt") != sha(HERE / "input/repo/requirements.txt"):
        raise RuntimeError("Probe requirements must exactly match frozen engine requirements.")
    return checked

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-archive", action="store_true", help="Read-only hash verification; no Office or environment setup")
    parser.add_argument("--output-name", help="Fresh root out/ directory name")
    parser.add_argument("--poppler-dir", type=Path, help="Optional pdftoppm.exe directory for the same 110 dpi pixel regression")
    args = parser.parse_args()
    manifest = json.loads((HERE / "input/archive-manifest.json").read_text(encoding="utf-8"))
    checked = check_archive(manifest)
    if args.check_archive:
        print(json.dumps(dict(status="archive_hashes_verified", files=checked, rerun=False)))
        return 0
    if sys.platform != "win32" or struct.calcsize("P") != 8 or sys.version_info[:2] != (3, 12):
        parser.error("Use Windows x64 and Python 3.12 from a venv.")
    if sys.prefix == sys.base_prefix:
        parser.error("Bootstrap from a venv Python; see README. Do not use system Python.")
    name = args.output_name or f"{HERE.name}-{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}"
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", name):
        parser.error("--output-name must be a simple ASCII name.")
    root = (REPO / "out" / name).resolve()
    if root.parent != (REPO / "out").resolve() or root.exists():
        parser.error("Output must be a new directory directly under repository out/.")
    poppler = args.poppler_dir.resolve() if args.poppler_dir else None
    if poppler and not (poppler / "pdftoppm.exe").is_file():
        parser.error("--poppler-dir must contain pdftoppm.exe.")
    root.mkdir(parents=True)
    workspace = root / "workspace"
    shutil.copytree(HERE / "input/repo", workspace)
    record = dict(probe=HERE.name, baseGitCommit=manifest["baseGitCommit"],
                  provenance=manifest["provenance"], archiveFilesChecked=checked,
                  bootstrapPython=sys.executable, workspace=str(workspace),
                  status="preparing", commands=[], visualReview="not_performed",
                  pixelComparison="pending" if poppler else "not_requested")
    record_path = root / "rerun.json"
    def save():
        record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    def execute(command):
        log = root / f"step-{len(record['commands']) + 1:02d}.txt"
        step = dict(argv=[str(x) for x in command], output=str(log))
        record["commands"].append(step)
        save()
        with log.open("w", encoding="utf-8") as stream:
            result = subprocess.run(step["argv"], cwd=workspace, env=CHILD_ENV,
                                    stdout=stream, stderr=subprocess.STDOUT)
        step["exitCode"] = result.returncode
        save()
        if result.returncode:
            raise RuntimeError(f"Step failed ({result.returncode}); inspect {log}")
    save()
    try:
        # The source guard requires ROOT/.venv. Create that actual environment;
        # never patch require_environment or import production code in this bootstrap.
        venv.EnvBuilder(with_pip=True, system_site_packages=False).create(workspace / ".venv")
        engine_python = workspace / ".venv/Scripts/python.exe"
        record["enginePython"] = str(engine_python)
        execute([engine_python, "-m", "pip", "--disable-pip-version-check", "install",
                 "--no-deps", "-r", workspace / "requirements.txt"])
        execute([engine_python, "-m", "pip", "--disable-pip-version-check", "install",
                 "--no-build-isolation", "--no-deps", "-e", workspace])
        execute([engine_python, "-m", "unittest", "discover", "-s", "tests", "-v"])
        destination = workspace / "out/result"
        execute([engine_python, "-m", "docreport", "build",
                 workspace / "reports/demo-report", "--out", destination])
        if poppler:
            execute([engine_python, HERE / "input/compare-pages.py",
                     HERE / "input/baseline/report.pdf", destination / "report.pdf", poppler, root])
            record["pixelComparison"] = "passed"
        record["status"] = "automation_completed_visual_review_pending"
    except Exception as exc:
        record.update(status="failed", error=str(exc))
        raise
    finally:
        save()
    print(record_path)
    print("Inspect every newly rendered page before recording visual acceptance.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

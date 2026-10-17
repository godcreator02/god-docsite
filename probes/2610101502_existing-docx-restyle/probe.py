"""Run frozen experiment code in a fresh root out/ workspace."""
import argparse
from datetime import datetime
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MANIFEST = HERE / "input/archive-manifest.json"
CHILD_ENV = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_archive(manifest):
    checked = 0
    for item in manifest["inputFiles"]:
        path = HERE / item["path"]
        if not path.is_file() or sha(path) != item["sha256"]:
            raise RuntimeError(f"Frozen input changed or missing: {path}")
        checked += 1
    for item in manifest["originalFiles"]:
        if not item["archive"]:
            continue
        path = HERE / item["archive"]
        if not path.is_file() or sha(path) != item["sha256"]:
            raise RuntimeError(f"Archived evidence changed or missing: {path}")
        checked += 1
    return checked

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-archive", action="store_true", help="Only verify hashes; no Word, MathType or writes")
    parser.add_argument("--output-name", help="Fresh directory name directly under repository out/")
    parser.add_argument("--pandoc", type=Path, help="Pandoc 3.12.1 executable (only route comparison)")
    parser.add_argument("--poppler-dir", type=Path, help="Optional directory with pdftoppm.exe for new page images")
    parser.add_argument("--prepare-only", action="store_true", help="Prepare copied workspace, without launching Office")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    checked = check_archive(manifest)
    if args.check_archive:
        print(json.dumps({"status": "archive_hashes_verified", "files": checked,
                          "historicalScope": manifest["conclusion"], "rerun": False}, ensure_ascii=False))
        return 0
    if Path(sys.prefix).resolve() != (HERE / ".venv").resolve() or sys.prefix == sys.base_prefix:
        parser.error("Use this probe's own .venv; see README for isolated installation.")
    if sys.version_info[:2] != (3, 12):
        parser.error("Historical runtime is Python 3.12. Use Python 3.12 in this probe's .venv.")
    for line in (HERE / "requirements.txt").read_text(encoding="utf-8").splitlines():
        pin = line.split(";")[0].strip()
        if not pin or pin.startswith("#"):
            continue
        package, version = pin.split("==")
        if importlib.metadata.version(package) != version:
            parser.error(f"Install this probe's requirements.txt: {package}=={version}")
    name = args.output_name or f"{HERE.name}-{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}"
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", name):
        parser.error("--output-name must be a simple ASCII directory name.")
    run_root = (REPO / "out" / name).resolve()
    if run_root.parent != (REPO / "out").resolve():
        parser.error("Output must be directly under repository out/.")
    if run_root.exists():
        parser.error(f"Output exists; use a fresh directory: {run_root}")
    mode = manifest["mode"]
    pandoc = args.pandoc
    if mode == "routes" and not args.prepare_only:
        if pandoc is None:
            candidate = shutil.which("pandoc")
            if not candidate:
                for evidence in sorted((HERE / "evidence").rglob("pandoc-generation.json")):
                    item = json.loads(evidence.read_text(encoding="utf-8"))
                    cmd = item.get("command", [])
                    if cmd and Path(cmd[0]).is_file():
                        candidate = cmd[0]
                        break
            pandoc = Path(candidate) if candidate else None
        if pandoc is None or not pandoc.is_file():
            parser.error("Pass --pandoc PATH to the separately installed Pandoc 3.12.1 executable.")
        version = subprocess.check_output([str(pandoc), "--version"], text=True).splitlines()[0]
        if version != "pandoc 3.12.1":
            parser.error(f"Expected pandoc 3.12.1, found: {version}")
    poppler = args.poppler_dir.resolve() if args.poppler_dir else None
    if poppler and not (poppler / "pdftoppm.exe").is_file():
        parser.error("--poppler-dir must contain pdftoppm.exe.")
    run_root.mkdir(parents=True)
    workspace = run_root / "workspace"
    shutil.copytree(HERE / "input/repo", workspace)
    result = workspace / "out/result"
    result.parent.mkdir(parents=True)
    if mode != "mathtype":
        result.mkdir()
    record = {"probe": HERE.name, "sourceCommit": manifest["sourceCommit"],
              "python": sys.executable, "archiveFilesChecked": checked,
              "resultDirectory": str(result), "commands": [], "status": "prepared",
              "visualReview": "not_performed"}
    record_path = run_root / "rerun.json"
    def save():
        record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    def execute(script, *arguments):
        command = [sys.executable, str(workspace / script), *[str(x) for x in arguments]]
        step = {"argv": command}
        record["commands"].append(step)
        save()
        log = run_root / f"step-{len(record['commands']):02d}.txt"
        with log.open("w", encoding="utf-8") as stream:
            completed = subprocess.run(command, cwd=workspace, stdout=stream, stderr=subprocess.STDOUT, text=True, env=CHILD_ENV)
        step.update(exitCode=completed.returncode, output=str(log))
        save()
        if completed.returncode:
            raise RuntimeError(f"Step failed ({completed.returncode}); inspect {log}")
    save()
    if args.prepare_only:
        print(record_path)
        return 0
    try:
        if mode == "routes":
            execute("routes/word-com/build.py", result)
            execute("routes/direct-docx/build.py", result)
            execute("routes/pandoc/build.py", result, pandoc.resolve())
            execute("scripts/word-verify.py", result)
        elif mode == "template":
            execute("routes/word-com/build.py", result)
            execute("scripts/word-verify.py", result, "--project-report")
        elif mode == "mathtype":
            execute("routes/word-com/mathtype-probe.py", "--out", result)
        elif mode == "report":
            execute("routes/word-com/build.py", result, "--mathtype")
        elif mode == "restyle":
            execute("routes/word-com/restyle.py", HERE / "input/source.docx", result)
        else:
            raise RuntimeError(f"Unknown archive mode: {mode}")
        if poppler:
            for pdf in sorted(result.glob("*.pdf")):
                pages = result / (pdf.stem + "-pages")
                pages.mkdir()
                command = [str(poppler / "pdftoppm.exe"), "-png", "-r", "110", str(pdf), str(pages / "page")]
                subprocess.run(command, check=True, capture_output=True)
        record["status"] = "automation_completed_visual_review_pending"
    except Exception as error:
        record.update(status="failed", error=str(error))
        raise
    finally:
        save()
    print(record_path)
    print("Automation finished. Inspect every PDF page before recording a new visual pass.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

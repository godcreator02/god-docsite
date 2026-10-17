"""Build a trusted local report with native Word and MathType."""
import argparse
from datetime import datetime, timezone
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import platform
import struct
import subprocess
import sys
import time
import traceback

from .mathtype import DEFAULT_DLL, fill_and_reopen, validate_pending
from .verify import document_state, package_state, pdf_state, sha
from .word import opened_document, refresh, word_application

ROOT = Path(__file__).resolve().parents[2]


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_report(directory):
    """Report modules are trusted Python supplied by the report's author."""
    directory = directory.resolve()
    content_path, module_path = directory / "content.json", directory / "report.py"
    content = json.loads(content_path.read_text(encoding="utf-8"))
    if not isinstance(content, dict) or not isinstance(content.get("template"), str):
        raise ValueError("content.json must be an object with a template path relative to the report directory.")
    template = (directory / content["template"]).resolve()
    if template.suffix.lower() != ".dotx" or not template.is_file():
        raise ValueError(f"Report template must be an existing .dotx: {template}")
    spec = importlib.util.spec_from_file_location("docreport_project", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in ("build", "validate"):
        if not callable(getattr(module, name, None)):
            raise ValueError(f"report.py must provide {name}(doc, content{', output' if name == 'build' else ''}).")
    for name in ("validate_editing", "validate_pdf"):
        if hasattr(module, name) and not callable(getattr(module, name)):
            raise ValueError(f"report.py {name} must be callable when provided.")
    return directory, content, module, template


def reserve_output(output, root=ROOT):
    output = output.resolve()
    allowed = (root / "out").resolve()
    if output == allowed or not output.is_relative_to(allowed):
        raise ValueError("Use a new subdirectory of the repository out/.")
    # Refuse even an empty existing directory: one invocation owns one run.
    output.mkdir(parents=True, exist_ok=False)
    return output


def require_environment():
    if sys.platform != "win32" or struct.calcsize("P") != 8:
        raise RuntimeError("Build requires Windows and 64-bit Python.")
    if sys.prefix == sys.base_prefix or Path(sys.prefix).resolve() != (ROOT / ".venv").resolve():
        raise RuntimeError("Run this project with its .venv\\Scripts\\python.exe.")


def inputs_manifest(directory, template):
    paths = set((ROOT / "src/docreport").glob("*.py"))
    paths.update((ROOT / name) for name in ("pyproject.toml", "requirements.txt"))
    paths.add(template)
    paths.update(p for p in directory.rglob("*") if p.is_file()
                 and not {"__pycache__", ".venv", ".git", "out"}.intersection(p.relative_to(directory).parts)
                 and p.suffix != ".pyc")
    return {str(p.relative_to(ROOT) if p.is_relative_to(ROOT) else p): sha(p) for p in sorted(paths)}


def build(directory, output, dll=DEFAULT_DLL):
    require_environment()
    directory, content, module, template = load_report(directory)
    output = reserve_output(output)
    started = time.perf_counter()
    template_hash = sha(template)
    inputs = inputs_manifest(directory, template)
    evidence = dict(status="running", startedAt=datetime.now(timezone.utc).isoformat(),
                    report=str(directory), visualReview="pending", events=[])

    def record(event, **values):
        evidence["events"].append(dict(event=event, **values))
        write_json(output / "verification.json", evidence)
        print(json.dumps(dict(event=event, **values), ensure_ascii=True), flush=True)

    manifest = dict(report=str(directory), inputs=inputs,
                    environment=dict(python=sys.version, executable=sys.executable,
                                     platform=platform.platform(),
                                     packages={name: importlib.metadata.version(name) for name in
                                               ("pywin32", "comtypes", "pypdf", "Pillow", "setuptools")}),
                    command=[sys.executable, "-m", "docreport", "build", str(directory),
                             "--out", str(output), "--mathtype-dll", str(dll)])
    git = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    manifest["baseGitCommit"] = git.stdout.strip() if git.returncode == 0 else None
    manifest["provenance"] = "Input hashes identify exact working files; baseGitCommit may precede local changes."
    draft, destination = output / "draft.docx", output / "report.docx"
    write_json(output / "manifest.json", manifest)
    record("start", template=str(template), templateSha256=template_hash)
    try:
        with word_application() as word:
            manifest["environment"]["word"] = dict(version=word.Version, build=word.Build)
            doc = word.Documents.Add(Template=str(template), NewTemplate=False)
            doc.UpdateStylesOnOpen = False
            pending = module.build(doc, content, output)
            validate_pending(pending)
            doc.SaveAs2(str(draft), 16, AddToRecentFiles=False)
            record("draft-saved", equations=len(pending))

        if pending:
            fill_and_reopen(draft, destination, pending, record, dll.resolve())
        else:
            # A report without formulas still uses exactly the same Word pipeline.
            destination.write_bytes(draft.read_bytes())
        with word_application() as word:
            with opened_document(word, destination) as doc:
                refresh(doc)
                doc.Save()
            with opened_document(word, destination, True) as doc:
                refresh(doc)
                generic = document_state(doc, len(pending))
                record("document-check", **generic)
                record("report-check", result=module.validate(doc, content))
                doc.ExportAsFixedFormat(str(destination.with_suffix(".pdf")), 17)
            saved_hash = sha(destination)
            if callable(getattr(module, "validate_editing", None)):
                with opened_document(word, destination, True) as doc:
                    record("editing-check-unsaved", result=module.validate_editing(doc, content))
                if sha(destination) != saved_hash:
                    raise RuntimeError("Editing checks modified the saved report.")

        record("package-check", **package_state(destination, len(pending)))
        pdf, texts = pdf_state(destination.with_suffix(".pdf"), generic["pages"])
        record("pdf-check", **pdf)
        if callable(getattr(module, "validate_pdf", None)):
            record("report-pdf-check", result=module.validate_pdf(texts, content))
        if inputs_manifest(directory, template) != inputs:
            raise RuntimeError("Report inputs or engine sources changed during generation; rerun with stable inputs.")
        evidence["status"] = "passed_automation_visual_review_pending"
        manifest["outputs"] = {p.name: sha(p) for p in (destination, destination.with_suffix(".pdf"))}
        manifest["templateUnchanged"] = sha(template) == template_hash
        record("finished", status=evidence["status"], seconds=round(time.perf_counter() - started, 3))
        return destination
    except Exception:
        evidence["status"] = "failed"
        record("exception", detail=traceback.format_exc())
        raise
    finally:
        write_json(output / "manifest.json", manifest)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    generate = commands.add_parser("build", help="Generate DOCX, PDF and automated verification from a report directory")
    generate.add_argument("report_directory", type=Path)
    generate.add_argument("--out", type=Path, required=True, help="Fresh directory under repository out/")
    generate.add_argument("--mathtype-dll", type=Path, default=DEFAULT_DLL)
    args = parser.parse_args()
    try:
        path = build(args.report_directory, args.out, args.mathtype_dll)
    except Exception as exc:
        print(f"docreport: {exc}", file=sys.stderr)
        return 1
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

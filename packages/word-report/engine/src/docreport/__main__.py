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
from types import SimpleNamespace

from .background import background_paused
from .content import read_json, validate_content, validate_layout
from .compose import ContentComposer
from .mathtype import DEFAULT_DLL, fill_and_reopen, validate_pending
from .plain_math import clear_east_asian_hints
from .verify import document_state, package_state, pdf_state, sha, content_state, abstract_state
from .word import opened_document, refresh, word_application

ROOT = Path(__file__).resolve().parents[2]


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_report(directory, *, data_only=False, layout_path=None):
    """Report modules are trusted Python supplied by the report's author."""
    directory = directory.resolve()
    content_path, module_path = directory / "content.json", directory / "report.py"
    content = read_json(content_path)
    if data_only and (not isinstance(content, dict) or content.get('format') != 'docreport'):
        raise ValueError('Data-only export requires a compiled docreport protocol document.')
    if isinstance(content, dict) and "format" in content:
        validate_content(content, directory)
        module = SimpleNamespace()
        if not data_only and module_path.is_file():
            spec = importlib.util.spec_from_file_location("docreport_project", module_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        if hasattr(module, 'build'):
            raise ValueError('Protocol reports use the common builder; report.py may supply LAYOUT, TEMPLATE and validation hooks.')
        template = (directory / getattr(module, 'TEMPLATE', str(ROOT / 'templates/project-report.dotx'))).resolve()
        if template.suffix.lower() != '.dotx' or not template.is_file():
            raise ValueError(f'Template is missing: {template}')
        if layout_path is not None and not data_only:
            raise ValueError('--layout requires --data-only; trusted local reports use report.py LAYOUT.')
        layout = read_json(layout_path) if layout_path is not None else getattr(module, 'LAYOUT', {})
        validate_layout(layout, content)
        module.build = lambda doc, data, output: ContentComposer(doc, data, directory, layout).build()
        if not hasattr(module, 'validate'):
            module.validate = lambda doc, data: {'status': 'passed', 'scope': 'common content checks'}
        for name in ('validate', 'validate_editing', 'validate_pdf'):
            if hasattr(module, name) and not callable(getattr(module, name)):
                raise ValueError(f'report.py {name} must be callable.')
        return directory, content, module, template
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


def reserve_output(output):
    output = output.resolve()
    # Refuse even an empty existing directory: one invocation owns one run.
    output.mkdir(parents=True, exist_ok=False)
    return output


def require_environment():
    if sys.platform != "win32" or struct.calcsize("P") != 8:
        raise RuntimeError("Build requires Windows and 64-bit Python.")
    if sys.prefix == sys.base_prefix:
        raise RuntimeError("Run the engine inside its uv environment: uv run --project <engine> --frozen python -m docreport ...")


def inputs_manifest(directory, template):
    paths = set((ROOT / "src/docreport").glob("*.py"))
    paths.update((ROOT / name) for name in ("pyproject.toml", "uv.lock", ".python-version"))
    paths.add(template)
    paths.add(ROOT / 'schemas/report-content.schema.json')
    paths.update(p for p in directory.rglob("*") if p.is_file()
                 and not {"__pycache__", ".venv", ".git", "out"}.intersection(p.relative_to(directory).parts)
                 and p.suffix != ".pyc")
    return {str(p.relative_to(ROOT) if p.is_relative_to(ROOT) else p): sha(p) for p in sorted(paths)}


def build(directory, output, dll=DEFAULT_DLL, *, data_only=False, layout_path=None):
    require_environment()
    directory, content, module, template = load_report(directory, data_only=data_only, layout_path=layout_path)
    output = reserve_output(output)
    started = time.perf_counter()
    template_hash = sha(template)
    inputs = inputs_manifest(directory, template)
    if layout_path is not None:
        layout_path = layout_path.resolve()
        inputs[str(layout_path)] = sha(layout_path)
    evidence = dict(status="running", startedAt=datetime.now(timezone.utc).isoformat(),
                    report=str(directory), visualReview="pending", events=[])

    # Rewriting the whole record per event is quadratic: a report with 858 equations logs ~3500 events.
    last_written = [0.0]

    def persist():
        write_json(output / "verification.json", evidence)
        last_written[0] = time.perf_counter()

    def record(event, **values):
        values.setdefault('elapsedSeconds', round(time.perf_counter() - started, 3))
        evidence["events"].append(dict(event=event, **values))
        if time.perf_counter() - last_written[0] >= 2:
            persist()
        print(json.dumps(dict(event=event, **values), ensure_ascii=True), flush=True)

    manifest = dict(report=str(directory), inputs=inputs,
                    environment=dict(python=sys.version, executable=sys.executable,
                                     platform=platform.platform(),
                                     packages={name: importlib.metadata.version(name) for name in
                                               ("pywin32", "comtypes", "pypdf", "Pillow", "jsonschema")}),
                    command=[sys.executable, "-m", "docreport", "build", str(directory),
                             "--out", str(output), "--mathtype-dll", str(dll)])
    git = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    manifest["baseGitCommit"] = git.stdout.strip() if git.returncode == 0 else None
    manifest["provenance"] = "Input hashes identify exact working files; baseGitCommit may precede local changes."
    manifest['dataOnly'] = data_only
    if data_only:
        manifest['command'].append('--data-only')
    if layout_path is not None:
        manifest['command'].extend(['--layout', str(layout_path)])
    draft, destination = output / "draft.docx", output / "report.docx"
    write_json(output / "manifest.json", manifest)
    record("start", template=str(template), templateSha256=template_hash)
    try:
        with word_application() as word:
            manifest["environment"]["word"] = dict(version=word.Version, build=word.Build)
            doc = word.Documents.Add(Template=str(template), NewTemplate=False)
            doc.UpdateStylesOnOpen = False
            record("compose-start")
            with background_paused(word, doc, record):
                pending = module.build(doc, content, output)
            validate_pending(pending)
            doc.SaveAs2(str(draft), 16, AddToRecentFiles=False)
            record("draft-saved", equations=len(pending))
        record("inline-math-hints-cleared", runs=clear_east_asian_hints(draft))

        if pending:
            fill_and_reopen(draft, destination, pending, record, dll.resolve())
        else:
            # A report without formulas still uses exactly the same Word pipeline.
            destination.write_bytes(draft.read_bytes())
        with word_application() as word:
            with opened_document(word, destination) as doc:
                refresh(doc)
                doc.Save()
            # Checks and the PDF read the field results as saved; refreshing again here would hide a stale save.
            with opened_document(word, destination, True) as doc:
                generic = document_state(doc, len(pending))
                record("document-check", **generic)
                if content.get('format') == 'docreport':
                    abstracts = abstract_state(doc, content)
                    if abstracts:
                        record('abstract-check', abstracts=abstracts)
                record("report-check-start")
                record("report-check", result=module.validate(doc, content))
                record("pdf-export-start")
                doc.ExportAsFixedFormat(str(destination.with_suffix(".pdf")), 17)
                record("pdf-export-finished")
            saved_hash = sha(destination)
            if callable(getattr(module, "validate_editing", None)):
                with opened_document(word, destination, True) as doc:
                    record("editing-check-unsaved", result=module.validate_editing(doc, content))
                if sha(destination) != saved_hash:
                    raise RuntimeError("Editing checks modified the saved report.")

        record("package-check", **package_state(destination, len(pending)))
        if content.get('format') == 'docreport':
            record('content-check', **content_state(destination, content, directory))
        pdf, texts = pdf_state(destination.with_suffix(".pdf"), generic["pages"])
        record("pdf-check", **pdf)
        if callable(getattr(module, "validate_pdf", None)):
            record("report-pdf-check", result=module.validate_pdf(texts, content))
        final_inputs = inputs_manifest(directory, template)
        if layout_path is not None:
            final_inputs[str(layout_path)] = sha(layout_path)
        if final_inputs != inputs:
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
        persist()
        write_json(output / "manifest.json", manifest)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    generate = commands.add_parser("build", help="Generate DOCX, PDF and automated verification from a report directory")
    generate.add_argument("report_directory", type=Path)
    generate.add_argument("--out", type=Path, required=True, help="Directory that does not exist yet")
    generate.add_argument("--mathtype-dll", type=Path, default=DEFAULT_DLL)
    generate.add_argument('--data-only', action='store_true', help='Export compiled protocol data without importing report.py')
    generate.add_argument('--layout', type=Path, help='Optional pure JSON layout for data-only exports')
    validate = commands.add_parser('validate', help='Validate compiled report input without starting Word')
    validate.add_argument('report_directory', type=Path)
    validate.add_argument('--data-only', action='store_true')
    validate.add_argument('--layout', type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'validate':
            directory, content, _, template = load_report(args.report_directory, data_only=args.data_only, layout_path=args.layout)
            print(json.dumps(dict(status='passed', report=str(directory), id=content.get('id'), template=str(template), dataOnly=args.data_only), ensure_ascii=False))
            return 0
        path = build(args.report_directory, args.out, args.mathtype_dll, data_only=args.data_only, layout_path=args.layout)
    except Exception as exc:
        print(f"docreport: {exc}", file=sys.stderr)
        return 1
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

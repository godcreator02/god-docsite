"""Bounded real Word benchmark; keep the same fixture for every variant."""
import argparse
import cProfile
from hashlib import sha256
import json
from pathlib import Path
import pstats
import shutil
import sys
import time

from docreport.__main__ import require_environment, reserve_output
from docreport.compose import ContentComposer
from frozen_content import read_json
from frozen_session import word_application, refresh

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def main():
    require_environment()
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['baseline', 'screen', 'pagination', 'bulk', 'xml', 'production'], default='baseline')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--limit', type=float, default=25)
    parser.add_argument('--fixture', default='fixture.json')
    parser.add_argument('--no-pdf', action='store_true', help='Measure composition; retain DOCX and all content/format checks.')
    args = parser.parse_args()
    output = reserve_output(args.out)
    fixture = HERE / args.fixture
    template = HERE / 'template.dotx'
    content = read_json(fixture)
    record = dict(mode=args.mode, python=sys.executable,
                  fixtureSha256=sha256(fixture.read_bytes()).hexdigest(),
                  templateSha256=sha256(template.read_bytes()).hexdigest(),
                  budgetSeconds=args.limit)
    try:
        with word_application() as word:
            record['word'] = dict(version=word.Version, build=word.Build)
            screen, pagination = word.ScreenUpdating, word.Options.Pagination
            try:
                if args.mode in ('screen', 'pagination'):
                    word.ScreenUpdating = False
                if args.mode == 'pagination':
                    word.Options.Pagination = False
                doc = word.Documents.Add(Template=str(template), NewTemplate=False)
                doc.UpdateStylesOnOpen = False
                from baseline_compose import ContentComposer as BaselineComposer
                cls = ContentComposer if args.mode == 'production' else BaselineComposer
                if args.mode == 'bulk':
                    from bulk import BulkComposer
                    cls = BulkComposer
                if args.mode == 'xml':
                    from xmlbulk import XmlComposer
                    cls = XmlComposer
                import inspect
                shutil.copy2(inspect.getsourcefile(cls), output / 'renderer.py')
                record['rendererSha256'] = sha256(Path(inspect.getsourcefile(cls)).read_bytes()).hexdigest()
                composer = cls(doc, content, HERE)
                profiler = cProfile.Profile()
                started = time.perf_counter()
                profiler.enable()
                composer.build()
                profiler.disable()
                record['composeSeconds'] = round(time.perf_counter() - started, 3)
                profiler.dump_stats(str(output / 'compose.prof'))
                with (output / 'profile.txt').open('w', encoding='utf-8') as stream:
                    pstats.Stats(profiler, stream=stream).strip_dirs().sort_stats('cumulative').print_stats(30)
                word.Options.Pagination = pagination
                refresh(doc)
                field_errors = [field.Result.Text for field in doc.Fields
                                if field.Result.Text.replace(' ', '').lower().startswith(('错误!', 'error!'))]
                if field_errors:
                    raise RuntimeError(f'Word field errors: {field_errors}')
                doc.SaveAs2(str(output / 'report.docx'), 16, AddToRecentFiles=False)
                if not args.no_pdf:
                    doc.ExportAsFixedFormat(str(output / 'report.pdf'), 17)
                record['pdfExported'] = not args.no_pdf
                from frozen_verify import content_state, native_text_state
                record['contentChecks'] = content_state(output / 'report.docx', content, HERE)
                record['formatChecks'] = native_text_state(output / 'report.docx', content)
                record['passed'] = record['composeSeconds'] < args.limit
            finally:
                word.Options.Pagination = pagination
                word.ScreenUpdating = screen
    except Exception:
        import traceback
        record['error'] = traceback.format_exc()
        raise
    finally:
        (output / 'timings.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(record, ensure_ascii=False), flush=True)
    return 0 if record['passed'] else 1


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())

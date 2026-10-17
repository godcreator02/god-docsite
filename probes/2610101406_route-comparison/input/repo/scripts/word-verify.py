"""Update, reopen, render and edit independent copies through native Word COM."""
import argparse
import json
from pathlib import Path
import time
from xml.etree import ElementTree
from zipfile import ZipFile
from word_com import word_application, opened_document

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ('word-com', 'pandoc', 'direct-docx')
NS = {'m': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}


def fraction_state(path):
    with ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read('word/document.xml'))
    maths = root.findall('.//m:oMath', NS)
    denominator = maths[1].find('.//m:den', NS)
    return len(maths), ''.join(denominator.itertext())


def verify(output, routes=ROUTES, reference_only=False):
    output = output.resolve()
    inputs = {route: output / ('pandoc.prepared.docx' if route == 'pandoc' else f'{route}.raw.docx') for route in routes}
    if not reference_only:
        for route, path in inputs.items():
            if not path.is_file():
                raise FileNotFoundError(path)
            for suffix in ['.docx', '.pdf', '.edit-check.docx']:
                if (output / (route + suffix)).exists():
                    raise FileExistsError(f'Use a fresh run: {output / (route + suffix)}')
    records = []
    with word_application() as word:
        if reference_only:
            with opened_document(word, ROOT / 'templates/sgcc-feasibility-2018-original.docx', True) as doc:
                doc.ExportAsFixedFormat(str(output / 'source-template.pdf'), 17)
            return
        for route, path in inputs.items():
            started = time.perf_counter()
            final = output / f'{route}.docx'
            edited = output / f'{route}.edit-check.docx'
            with opened_document(word, path) as doc:
                opened = time.perf_counter() - started
                doc.Fields.Update()
                for toc in doc.TablesOfContents:
                    toc.Update()
                doc.Repaginate()
                for toc in doc.TablesOfContents:
                    toc.UpdatePageNumbers()
                doc.SaveAs2(str(final), 16)
                saved = time.perf_counter() - started
            with opened_document(word, final) as doc:
                doc.Repaginate()
                doc.ExportAsFixedFormat(str(output / f'{route}.pdf'), 17)
                record = dict(route=route, controller='Python + pywin32', wordVersion=word.Version, wordBuild=word.Build,
                              openSeconds=opened, updateSaveSeconds=saved - opened,
                              reopenExportSeconds=time.perf_counter() - started - saved,
                              pages=doc.ComputeStatistics(2), equations=doc.OMaths.Count,
                              tables=doc.Tables.Count, rows=doc.Tables.Item(1).Rows.Count,
                              toc=doc.TablesOfContents.Count, fields=doc.Fields.Count,
                              formulaText=[math.Range.Text for math in doc.OMaths])
                rng = doc.OMaths.Item(2).Range.Duplicate
                rng.Find.ClearFormatting()
                if not rng.Find.Execute(FindText='1', Forward=False, Wrap=0):
                    raise RuntimeError('Denominator constant not found')
                rng.Text = '2'
                doc.SaveAs2(str(edited), 16)
            with opened_document(word, edited, True) as doc:
                record['editedFraction'] = doc.OMaths.Item(2).Range.Text
                reopened_math_count = doc.OMaths.Count
            # Check the denominator specifically; finding any '2' would also match s^2.
            before_count, before = fraction_state(final)
            after_count, after = fraction_state(edited)
            record['editCheck'] = (before_count == after_count == reopened_math_count == 6
                                   and before.endswith('1') and after == before[:-1] + '2')
            if not record['editCheck']:
                raise AssertionError(f'{route}: denominator edit did not survive reopen')
            records.append(record)
            (output / 'word-verification.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'{route}: pages={record["pages"]}, equations={record["equations"]}, edit={record["editCheck"]}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output_directory', type=Path)
    parser.add_argument('--routes', choices=ROUTES, nargs='+', default=list(ROUTES))
    parser.add_argument('--reference-only', action='store_true')
    args = parser.parse_args()
    verify(args.output_directory, args.routes, args.reference_only)

"""Rebuild the accepted full report without modifying its saved input/output."""
import argparse
import cProfile
import json
from pathlib import Path
import pstats
import shutil
import sys
from docreport.__main__ import ROOT, build, require_environment, reserve_output
from docreport.verify import sha


def main():
    require_environment()
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-out', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--composer', choices=['production', 'xml'], default='production')
    args = parser.parse_args()
    if args.composer == 'xml':
        import docreport.__main__ as engine
        from xmlbulk import XmlComposer
        engine.ContentComposer = XmlComposer
    source = ROOT / 'out/sst-full-r01'
    baseline = ROOT / 'out/sst-full-render-r06'
    manifest = json.loads((baseline / 'manifest.json').read_text(encoding='utf-8'))
    directory = reserve_output(args.input_out)
    for name in ('content.json', 'project-report-noimgcompress.dotx'):
        expected = manifest['inputs'][str((source / name).relative_to(ROOT))]
        if sha(source / name) != expected:
            raise RuntimeError(f'Accepted source changed: {name}')
        shutil.copy2(source / name, directory / name)
    shutil.copytree(source / 'assets', directory / 'assets')
    module = directory / 'report.py'
    baseline_module = Path(__file__).resolve().parent / 'baseline_report.py'
    if sha(baseline_module) != manifest['inputs'][str((source / 'report.py').relative_to(ROOT))]:
        raise RuntimeError('Frozen baseline report module changed.')
    text = baseline_module.read_text(encoding='utf-8')
    begin = text.index('    # Native character formatting:')
    end = text.index('    for eq in equations:', begin)
    text = text[:begin] + '''    # Inspect the saved Word formatting in one package read.
    from pathlib import Path
    from docreport.verify import native_text_state
    native = native_text_state(Path(doc.FullName), content)
    checked, scripted = native['nativeTextRuns'], native['nativeScriptRuns']

''' + text[end:]
    module.write_text(text, encoding='utf-8')
    profile = cProfile.Profile()
    try:
        profile.enable()
        build(directory, args.out)
    finally:
        profile.disable()
        output = args.out.resolve()
        profile.dump_stats(str(output / 'full.prof'))
        with (output / 'profile.txt').open('w', encoding='utf-8') as stream:
            pstats.Stats(profile, stream=stream).strip_dirs().sort_stats('cumulative').print_stats(45)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()

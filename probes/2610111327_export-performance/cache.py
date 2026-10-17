"""Measure ten editable MathType formulas cold and reused; always reopen all."""
import argparse
import json
from pathlib import Path
import sys
import time
from docreport.content import walk, bookmark
from docreport.mathtype import fill_and_reopen, DEFAULT_DLL
from docreport.__main__ import reserve_output, ROOT
from docreport.verify import sha, package_state


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--early', action='store_true')
    args = parser.parse_args()
    if args.early:
        import comtypes.client
        original = comtypes.client.CreateObject
        def create(*a, **kw):
            kw['dynamic'] = False
            return original(*a, **kw)
        comtypes.client.CreateObject = create
    output = reserve_output(args.out)
    source = ROOT / 'out/sst-full-r01'
    content = json.loads((source/'content.json').read_text(encoding='utf-8'))
    pending = [dict(token=f'@MATH{i}@', equation=dict(id=bookmark(n['id']), latex=n['latex']), kind='math')
               for i, n in enumerate(n for n in walk(content) if n.get('type') == 'equation')]
    result = []
    for name in ('cold', 'warm'):
        events = []
        start = time.perf_counter()
        def record(event, **values):
            events.append(dict(event=event, elapsedSeconds=round(time.perf_counter()-start, 3), **values))
        destination = output / (name + '.docx')
        try:
            fill_and_reopen(ROOT/'out/perf-full-render-r03/draft.docx', destination, pending, record,
                            DEFAULT_DLL, cache_directory=output/'cache',
                            template_hash=sha(source/'project-report-noimgcompress.dotx'))
            check = package_state(destination, len(pending))
            result.append(dict(mode=name, seconds=round(time.perf_counter()-start, 3), check=check,
                               cacheHits=sum(e['event']=='equation-cache-hit' for e in events)))
        finally:
            (output/(name+'.json')).write_text(json.dumps(events, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(result[-1], ensure_ascii=False), flush=True)
    assert result[1]['cacheHits'] == len(pending), result
    (output/'summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()

"""One uncached full build, then three fresh Word runs with formula reuse."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time
import statistics
from docreport.__main__ import ROOT, reserve_output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    output = reserve_output(args.out)
    results = []
    for index in range(4):
        name = 'uncached' if index == 0 else f'cached-{index}'
        run = output/name
        command = [sys.executable, '-m', 'docreport', 'build', str(args.input.resolve()),
                   '--out', str(run), '--cache-dir', str(output/'cache')]
        started = time.perf_counter()
        process = subprocess.run(command, cwd=ROOT, capture_output=True)
        wall = time.perf_counter()-started
        (output/(name+'.txt')).write_bytes(process.stdout+process.stderr)
        evidence = json.loads((run/'verification.json').read_text(encoding='utf-8'))
        if process.returncode or not evidence['status'].startswith('passed_automation'):
            raise RuntimeError(f'Full repeat failed: {run}')
        events = evidence['events']
        checkpoints = {e['event']:e['elapsedSeconds'] for e in events}
        item = dict(name=name, command=command, wallSeconds=round(wall,3), buildSeconds=checkpoints['finished'],
                    cacheHits=sum(e['event']=='equation-cache-hit' for e in events), checkpoints=checkpoints)
        if item['cacheHits'] != (0 if index == 0 else 10):
            raise RuntimeError(f'Expected cold then ten cached formulas: {item}')
        results.append(item)
        (output/'runs.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({k:item[k] for k in ('name','wallSeconds','buildSeconds','cacheHits')}), flush=True)
    summary = dict(runs=results, cachedMedian=statistics.median(r['wallSeconds'] for r in results[1:]),
                   policy='Every build owns new Word processes. The cache directory is fresh, so the first run recreates ten formulas; subsequent three runs reuse all ten verified formulas. Each run saves/reopens, checks numbering/content and exports the entire PDF. OS and COM wrapper caches are not cleared.')
    (output/'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()

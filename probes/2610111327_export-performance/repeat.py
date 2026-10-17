"""Four paired, sequential real Word measurements; no concurrent Word load."""
import argparse
import json
from pathlib import Path
import statistics
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    output = args.out.resolve()
    if not output.is_relative_to(ROOT / 'out'):
        raise ValueError('Use repository out/.')
    output.mkdir(parents=True, exist_ok=False)
    runs = []
    for index in range(4):
        for mode in ('baseline', 'production'):
            run = output / f'{mode}-{index + 1}'
            command = [sys.executable, str(HERE / 'probe.py'), '--mode', mode,
                       '--out', str(run), '--no-pdf']
            result = subprocess.run(command, cwd=ROOT, capture_output=True)
            (output / f'{mode}-{index + 1}.log').write_bytes(result.stdout + result.stderr)
            record = json.loads((run / 'timings.json').read_text(encoding='utf-8'))
            if record.get('error') or 'composeSeconds' not in record:
                raise RuntimeError(f'Benchmark failed: {run}')
            runs.append(record)
            (output / 'runs.json').write_text(json.dumps(runs, ensure_ascii=False, indent=2), encoding='utf-8')
            print(json.dumps({'mode': mode, 'run': index + 1, 'composeSeconds': record['composeSeconds']}, ensure_ascii=False), flush=True)
    baseline = [r['composeSeconds'] for r in runs if r['mode'] == 'baseline']
    production = [r['composeSeconds'] for r in runs if r['mode'] == 'production']
    result = dict(baseline=baseline, production=production,
                  baselineMedian=statistics.median(baseline),
                  productionMedian=statistics.median(production),
                  fasterFactor=statistics.median(baseline) / statistics.median(production),
                  policy='Fresh private Word process for every run. First pair plus three consecutive pairs. PDF excluded from this composition measurement; saved content and formatting verified each time.')
    result['passed'] = result['productionMedian'] < 0.7 * result['baselineMedian']
    (output / 'summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())

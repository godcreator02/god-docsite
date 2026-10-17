"""Repeat whole-artifact reuse four times; no Word/MathType startup."""
import argparse
import statistics
from common import *


def adopt(directory,baseline):
    manifest=read(baseline/'manifest.json')
    assert all(sha(baseline/name)==value for name,value in manifest['outputs'].items())
    assert read(baseline/'verification.json')['status']=='passed_automation_visual_review_pending'
    assert all(sha(ROOT/name)==value for name,value in manifest['inputs'].items())
    seal(directory,baseline)


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--baseline',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--create-baseline',action='store_true')
    args=parser.parse_args()
    baseline=args.baseline.resolve(); directory=HERE/'fixture'
    if args.create_baseline:full(directory,baseline)
    if not (baseline/'state.json').exists():adopt(directory,baseline)
    output=reserve_output(args.out)
    runs=[]
    for i in range(4):
        result=update(directory,baseline,output/f'run-{i}')
        record=read(result/'experiment.json')
        assert record['mode']=='reuse' and record['outputHashesEqual'] and not record['wordLaunched']
        runs.append(record)
    write(output/'summary.json',dict(runs=runs,medianSeconds=statistics.median(r['seconds'] for r in runs),passed=True))
    archive(output)
    print(json.dumps(dict(output=str(output),medianSeconds=statistics.median(r['seconds'] for r in runs))))


if __name__=='__main__':main()

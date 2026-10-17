"""Compare ordered PDF text extraction on one vs four processes."""
import argparse
import json
from pathlib import Path
import time
from docreport.verify import pdf_state


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    results, expected = [], None
    for workers in (1, 4):
        start = time.perf_counter()
        state, texts = pdf_state(args.pdf, 51, workers=workers)
        results.append(dict(state, seconds=round(time.perf_counter()-start, 3)))
        if expected is None:
            expected = texts
        else:
            assert texts == expected, 'Parallel text extraction changed page order or content.'
    args.out.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results))


if __name__ == '__main__':
    main()

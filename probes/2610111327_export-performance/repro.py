"""Replay using the frozen engine, not future production source."""
import os
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('small', 'full'):
        raise SystemExit('Usage: repro.py small|full --out out/<fresh-name>')
    mode = sys.argv.pop(1)
    engine = str(HERE/'engine')
    sys.path.insert(0, engine)
    os.environ['PYTHONPATH'] = engine
    if mode == 'small':
        from repeat import main as run
    else:
        from repeat_full import main as run
        if '--input' not in sys.argv:
            sys.argv.extend(['--input', str(HERE/'full-input')])
    run()


if __name__ == '__main__':
    main()

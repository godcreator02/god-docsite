"""stdin: JSON list of TeX strings; stdout: JSON object TeX -> runs, or null where 0.4.2 used MathType."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from plain_math_0_4_2 import plain_runs  # noqa: E402

result = {}
for tex in json.load(sys.stdin):
    runs = plain_runs(tex)
    result[tex] = None if runs is None else [dict(text=r.text, italic=r.italic, script=r.script) for r in runs]
sys.stdout.reconfigure(encoding='utf-8')
json.dump(result, sys.stdout, ensure_ascii=False)

"""几版排版稿写法在同一个 Word 里轮流写，比耗时；第一轮各版更新域后存盘，和原版比对正文与脚注 XML。

python compose_ab.py <样本目录> <每章留几个子节，0 是全留> <轮数> <存盘目录> <版本…>
版本取 v060（0.6.0 的原版）、engine（运行它的 .venv 里装的引擎）、fast、fast2、fast3（试验子类，建在 engine 上）。
机器负载会变，轮流跑让各版受到同样的影响；看每版的中位数。
"""
import copy
import psutil
import statistics
import subprocess
import sys
import time
from pathlib import Path

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
import docreport.compose as compose
from docreport.compose import ContentComposer
from docreport.word import refresh, word_application
from fast_composer import FastComposer
from fast_composer2 import FastComposer2
from fast_composer3 import FastComposer3
from compose_bench_sample import trimmed_content
from compose_0_6_0 import ContentComposer as ContentComposer060

AVAILABLE = {'v060': ContentComposer060, 'engine': ContentComposer, 'fast': FastComposer, 'fast2': FastComposer2, 'fast3': FastComposer3}
sample, keep, rounds, out = Path(sys.argv[1]).resolve(), int(sys.argv[2]), int(sys.argv[3]), Path(sys.argv[4]).resolve()
names = sys.argv[5:]
if not names or any(name not in AVAILABLE for name in names):
    raise SystemExit(f'版本只能是 {", ".join(AVAILABLE)}')
out.mkdir(parents=True, exist_ok=False)
content = trimmed_content(sample, keep)
template = Path(compose.__file__).resolve().parents[2] / 'templates' / 'project-report.dotx'
seconds = {name: [] for name in names}
cpu = {name: [] for name in names}
script_started = time.time()

with word_application() as word:
    # 本脚本起的 Word：脚本开始之后创建的 WINWORD 进程里最新的那个
    word_process = max((p for p in psutil.process_iter(['name', 'create_time']) if p.info['name'] and p.info['name'].lower() == 'winword.exe' and p.info['create_time'] >= script_started - 1), key=lambda p: p.info['create_time'])
    for round_index in range(rounds):
        order = names[round_index % len(names):] + names[:round_index % len(names)]
        for name in order:
            doc = word.Documents.Add(Template=str(template), NewTemplate=False)
            doc.UpdateStylesOnOpen = False
            started, python_cpu, word_cpu = time.perf_counter(), time.process_time(), sum(word_process.cpu_times()[:2])
            AVAILABLE[name](doc, copy.deepcopy(content), sample, {}).build()
            seconds[name].append(time.perf_counter() - started)
            cpu[name].append(time.process_time() - python_cpu + sum(word_process.cpu_times()[:2]) - word_cpu)
            if round_index == 0:
                refresh(doc)  # 比对更新域之后的样子：排版稿里域的旧结果不算
                doc.SaveAs2(str(out / f'{name}.docx'), 16, AddToRecentFiles=False)
            doc.Close(SaveChanges=0)
            print(f'第 {round_index + 1} 轮 {name}：墙钟 {seconds[name][-1]:.1f} 秒，CPU（Python 加 Word）{cpu[name][-1]:.1f} 秒', flush=True)

for name, values in seconds.items():
    print(f'{name}：墙钟中位数 {statistics.median(values):.1f} 秒，CPU 中位数 {statistics.median(cpu[name]):.1f} 秒；各轮 CPU {", ".join(f"{v:.1f}" for v in cpu[name])}')
for name in names[1:]:
    print(f'== {names[0]} 对 {name}')
    subprocess.run([sys.executable, str(here / 'compare_docx.py'), str(out / f'{names[0]}.docx'), str(out / f'{name}.docx')])

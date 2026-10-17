# 整条导出流程测时，按阶段给秒数：python bench.py <样本目录> <layout.json> <标签>
# 用哪份引擎由运行它的 .venv 决定；输出写在那份引擎的 out/bench-<标签>-<时刻>/
import sys, time
from pathlib import Path

import docreport.__main__ as main
from docreport.compose import ContentComposer

stages = {}


def timed(name, function):
    def wrapper(*args, **kwargs):
        started = time.perf_counter()
        try:
            return function(*args, **kwargs)
        finally:
            stages[name] = stages.get(name, 0) + time.perf_counter() - started
    return wrapper


import os
EXPERIMENTS = {
    'proofing': {'CheckSpellingAsYouType': False, 'CheckGrammarAsYouType': False},
    'pagination': {'Pagination': False},
}
chosen = {k: v for name in filter(None, os.environ.get('BENCH_OPTIONS', '').split(',')) for k, v in EXPERIMENTS[name].items()}
original_build = ContentComposer.build


def build_with_options(self):
    options = self.doc.Application.Options
    saved = {name: getattr(options, name) for name in chosen}
    print('Word 选项原值', saved, '改为', chosen, flush=True)
    for name, value in chosen.items():
        setattr(options, name, value)
    try:
        return original_build(self)
    finally:
        for name, value in saved.items():
            setattr(options, name, value)


ContentComposer.build = timed('排版稿', build_with_options)
ContentComposer.finish = timed('　其中填域与书签', ContentComposer.finish)
if os.environ.get('BENCH_DETAIL'):
    for method, label in (('table_node', '　其中表格（含格内段落）'), ('figure_node', '　其中图'), ('equation', '　其中行间公式占位'),
                          ('rich_paragraph', '　其中带格式段落（含表格内）'), ('mark', '　其中书签'), ('trim_container', '　其中清理格末空段'),
                          ('point', '　其中取插入点'), ('section', '　其中节（含全部内容）')):
        setattr(ContentComposer, method, timed(label, getattr(ContentComposer, method)))
main.fill_and_reopen = timed('公式', main.fill_and_reopen)
import docreport.mathtype as mathtype_module
original_operate = mathtype_module.operate_equation


def operate_split(lib, record, shape, stage, expected, replacement=None):
    label = '　其中重开核对（每个）' if stage.startswith('reopened-') else '　其中写入公式（每个，不含插入）'
    return timed(label, original_operate)(lib, record, shape, stage, expected, replacement)


mathtype_module.operate_equation = operate_split
main.refresh = timed('更新域与目录', main.refresh)
main.content_state = timed('内容核对', main.content_state)

sample, layout, label = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
out = main.ROOT / 'out' / f'bench-{label}-{time.strftime("%H%M%S")}'
started = time.perf_counter()
try:
    main.build(sample, out, data_only=True, layout_path=layout)
    status = '通过'
except Exception as error:
    import traceback
    status = f'失败：{str(error)[:160]}\n  ' + traceback.format_exc()[-900:].replace('\n', '\n  ')
total = time.perf_counter() - started
print(f'[{label}] 共 {total:.1f} 秒，{status}')
for name, seconds in stages.items():
    print(f'  {name}：{seconds:.1f} 秒')
import docreport.compose as compose_module
for name, seconds in getattr(compose_module, 'TIMES', {}).items():
    print(f'  表格内·{name}：{seconds:.1f} 秒')
print(f'  输出：{out}')

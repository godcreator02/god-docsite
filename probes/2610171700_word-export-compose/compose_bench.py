"""只测排版稿一步，按项拆开计时：python compose_bench.py <样本目录> <每章留几个子节，0 是全留> <标签> [fast|fast2]

用运行它的 .venv 里装的那份引擎；文档写完不存盘直接关掉。各项有嵌套，不能相加。
"""
import copy
import json
import sys
import time
from pathlib import Path

import docreport.compose as compose
import docreport.word as word_module
from docreport.compose import ContentComposer
from docreport.word import word_application

sys.path.insert(0, str(Path(__file__).resolve().parent))
sample, keep, label = Path(sys.argv[1]).resolve(), int(sys.argv[2]), sys.argv[3]
if len(sys.argv) > 4:
    if sys.argv[4] == 'fast':
        from fast_composer import FastComposer as ContentComposer
    elif sys.argv[4] == 'fast2':
        from fast_composer2 import FastComposer2 as ContentComposer
    else:
        raise SystemExit('第 4 个参数只能是 fast 或 fast2')
content = json.loads((sample / 'content.json').read_text(encoding='utf-8'))
if keep:
    for block in content['blocks']:
        if block['type'] == 'section':
            block['children'] = block['children'][:keep]
    kept = set()

    def collect(value):
        if isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, dict):
            if isinstance(value.get('id'), str):
                kept.add(value['id'])
            for item in value.values():
                collect(item)

    def rewrite(value):
        if isinstance(value, list):
            for index, item in enumerate(value):
                if isinstance(item, dict) and item.get('type') == 'ref' and item['target'] not in kept:
                    value[index] = {'type': 'text', 'text': '第 x 节'}
                rewrite(value[index])
        elif isinstance(value, dict):
            for item in value.values():
                rewrite(item)

    collect(content['blocks'])
    rewrite(content['blocks'])

times, counts = {}, {}


def timed(name, function):
    def wrapper(*args, **kwargs):
        started = time.perf_counter()
        counts[name] = counts.get(name, 0) + 1
        try:
            return function(*args, **kwargs)
        finally:
            times[name] = times.get(name, 0) + time.perf_counter() - started
    return wrapper


for method, name in (('table_node', '表格（含格内段落）'), ('rich_paragraph', '带格式段落'), ('mark', '书签'),
                     ('figure_node', '图'), ('finish', '填域与书签'), ('point', '取插入点'),
                     ('apply_marks', '设文字格式'), ('single_paragraph_cell', '单段单元格')):
    setattr(ContentComposer, method, timed(name, getattr(ContentComposer, method)))
word_module.MarkerFinder.find = timed('　填域·找占位符', word_module.MarkerFinder.find)
compose.MarkerFinder = word_module.MarkerFinder


class TimedFields:
    """包住 doc.Fields，单独计 Fields.Add 的时间"""

    def __init__(self, fields):
        self._fields = fields

    def Add(self, *args):
        return timed('　填域·Fields.Add', self._fields.Add)(*args)

    def __getattr__(self, name):
        return getattr(self._fields, name)


class TimedDocument:
    def __init__(self, doc):
        self._doc = doc

    @property
    def Fields(self):
        return TimedFields(self._doc.Fields)

    @property
    def Bookmarks(self):
        bookmarks = self._doc.Bookmarks

        class TimedBookmarks:
            def Add(self, *args):
                return timed('Bookmarks.Add（含填域里的）', bookmarks.Add)(*args)

            def __getattr__(self, name):
                return getattr(bookmarks, name)
        return TimedBookmarks()

    def __getattr__(self, name):
        return getattr(self._doc, name)


template = Path(compose.__file__).resolve().parents[2] / 'templates' / 'project-report.dotx'
started = time.perf_counter()
with word_application() as word:
    doc = word.Documents.Add(Template=str(template), NewTemplate=False)
    doc.UpdateStylesOnOpen = False
    opened = time.perf_counter()
    composer = ContentComposer(TimedDocument(doc), copy.deepcopy(content), sample, {})
    composer.doc = TimedDocument(doc)
    build_started = time.perf_counter()
    pending = composer.build()
    built = time.perf_counter()
    stats = dict(fields=len(composer._pending_fields), numbers=len(composer._pending_numbers), mathtype=len(pending),
                 tables=doc.Tables.Count, paragraphs=doc.Paragraphs.Count)
print(f'[{label}] 排版稿 {built - build_started:.1f} 秒（启动 Word 与新建文档 {opened - started:.1f} 秒）{json.dumps(stats, ensure_ascii=False)}')
for name, seconds in times.items():
    print(f'  {name}：{seconds:.1f} 秒 / {counts[name]} 次')

# 剖析「生成排版稿」一步：python prof_compose.py <报告目录> <layout.json> <输出 .prof>
import cProfile, pstats, sys, time
from pathlib import Path

from docreport.__main__ import load_report
from docreport.compose import ContentComposer
from docreport.word import word_application

directory, layout, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
directory, content, module, template = load_report(directory, data_only=True, layout_path=layout)

stages = {}
original_finish, original_blocks = ContentComposer.finish, ContentComposer.blocks


def timed_finish(self):
    started = time.perf_counter()
    try:
        return original_finish(self)
    finally:
        stages['finish'] = time.perf_counter() - started


ContentComposer.finish = timed_finish

with word_application() as word:
    doc = word.Documents.Add(Template=str(template), NewTemplate=False)
    doc.UpdateStylesOnOpen = False
    profile = cProfile.Profile()
    started = time.perf_counter()
    profile.enable()
    pending = module.build(doc, content, None)
    profile.disable()
    stages['build total'] = time.perf_counter() - started
    print('pages', doc.ComputeStatistics(2), 'equations', len(pending), 'fields', doc.Fields.Count, 'bookmarks', doc.Bookmarks.Count, flush=True)
    doc.Close(0)

profile.dump_stats(str(out))
print({k: round(v, 1) for k, v in stages.items()}, flush=True)
stats = pstats.Stats(str(out))
stats.sort_stats('tottime').print_stats(25)
stats.sort_stats('cumulative').print_stats(40)

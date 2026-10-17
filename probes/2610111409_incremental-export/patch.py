"""Fixed ten-page local edits; optionally compare with a fresh serial rebuild."""
import argparse
import statistics
from common import *


def variant(output,mode):
    directory=output/'input'
    shutil.copytree(HERE/'fixture',directory,ignore=shutil.ignore_patterns('__pycache__'))
    content=read(directory/'content.json')
    index={n['id']:n for n in walk(content) if 'id' in n}
    if mode in ('paragraph','combined'):
        index['p-edit']['content']=[dict(type='text',text='这一段已更新：中文与😀 '),dict(type='text',text='x',marks=['em']),dict(type='text',text='2',marks=['sup']),dict(type='text',text=' 的格式应正确，后面的普通文字保持正体。')]
    if mode in ('table','combined'):
        index['cell-p-1-1']['content']=[dict(type='text',text='125 kW')]
    if mode in ('formula','combined'):index['eq-edit']['latex']=r'P=VI\eta'
    write(directory/'content.json',content)
    return directory


def signature(path):
    w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
        names={n.get(w+'id'):n.get(w+'name') for n in root.iter(w+'bookmarkStart')}
        active={}; values={}
        for n in root.iter():
            if n.tag==w+'bookmarkStart':active[n.get(w+'id')]=[]
            elif n.tag==w+'bookmarkEnd':
                ident=n.get(w+'id');text=''.join(active.pop(ident,[]));name=names.get(ident,'')
                if name.startswith('DR_') and not name.startswith('DR__Toc'):values[name]=text
            elif n.tag==w+'t':
                for parts in active.values():parts.append(n.text or '')
        return dict(bookmarks=values,tables=[[''.join(t.itertext()) for t in tbl.findall('.//'+w+'t')] for tbl in root.iter(w+'tbl')])


def main():
    p=argparse.ArgumentParser(__doc__)
    p.add_argument('--baseline',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--mode',choices=['paragraph','table','formula','combined'],default='combined')
    p.add_argument('--repeat',type=int,default=1);p.add_argument('--oracle',action='store_true')
    args=p.parse_args(); output=reserve_output(args.out); directory=variant(output,args.mode)
    runs=[]
    try:
        for i in range(args.repeat):
            result=update(directory,args.baseline.resolve(),output/f'run-{i}')
            value=read(result/'experiment.json');runs.append(value)
            write(output/'runs.json',runs)
            if value.get('status')!='passed_automation_visual_review_pending':raise RuntimeError(str(value))
            print(json.dumps(value,ensure_ascii=True),flush=True)
        comparison=None
        if args.oracle:
            reference=full(directory,output/'full-oracle')
            comparison=dict(savedContentEqual=signature(reference/'report.docx')==signature(result/'report.docx'))
            from pypdf import PdfReader
            extract=lambda path:[''.join((p.extract_text() or '').split()) for p in PdfReader(path).pages]
            comparison['perPageTextEqual']=extract(reference/'report.pdf')==extract(result/'report.pdf')
            write(output/'comparison.json',comparison)
            if not all(comparison.values()):raise RuntimeError('Incremental output differs from fresh serial build.')
        write(output/'summary.json',dict(mode=args.mode,runs=runs,medianSeconds=statistics.median(r['seconds'] for r in runs),comparison=comparison,passed=True))
    finally:archive(output)


if __name__=='__main__':main()

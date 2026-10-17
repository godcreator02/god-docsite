"""Snapshot the human-saved file; read revisions/comments without touching the live Word document."""
import argparse
from collections import Counter
from difflib import SequenceMatcher
from hashlib import sha256
import io
import json
from pathlib import Path
import shutil
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from word_session import word_application, opened_document, story_ranges

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def digest(path):return sha256(path.read_bytes()).hexdigest()


def package(path):
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
        def text(node,accept):
            if node.tag in (W+'del',W+'moveFrom') and accept:return ''
            if node.tag in (W+'ins',W+'moveTo') and not accept:return ''
            if node.tag in (W+'t',W+'delText'):return node.text or ''
            if node.tag==W+'tab':return '\t'
            if node.tag==W+'br':return '\n'
            return ''.join(text(c,accept) for c in node)
        revisions=[]
        for part in z.namelist():
            if not part.startswith('word/') or not part.endswith('.xml'):continue
            for n in ET.fromstring(z.read(part)).iter():
                kind=n.tag.removeprefix(W)
                if kind in ('ins','del','moveFrom','moveTo','rPrChange','pPrChange','tblPrChange','trPrChange','tcPrChange'):
                    revisions.append(dict(part=part,type=kind,id=n.get(W+'id'),author=n.get(W+'author'),date=n.get(W+'date'),
                        text=''.join(v.text or '' for v in n.iter() if v.tag in (W+'t',W+'delText'))))
        return dict(acceptedParagraphs=[text(p,True) for p in root.iter(W+'p')],
                    rejectedParagraphs=[text(p,False) for p in root.iter(W+'p')],xmlRevisions=revisions,
                    embeddedPayloads={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/embeddings/')},
                    mediaPayloads={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/')})


def optional(obj,name):
    try:return getattr(obj,name)
    except Exception:return None


def main():
    p=argparse.ArgumentParser(__doc__);p.add_argument('--session',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    args=p.parse_args();session_dir=args.session.resolve();session=read(session_dir/'session.json');output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Use a fresh out/ child')
    output.mkdir(parents=True,exist_ok=False)
    live=Path(session['reviewPath']);baseline=Path(session['baselinePath'])
    if digest(baseline)!=session['baselineSha256']:raise RuntimeError('The immutable sent baseline changed')
    data=live.read_bytes()
    if sha256(data).hexdigest()!=digest(live):raise RuntimeError('Review file changed during capture; save and retry')
    with ZipFile(io.BytesIO(data)) as z:
        if z.testzip() is not None:raise RuntimeError('Saved DOCX is incomplete')
        # Read the persisted batch identity directly. This Office build exposes
        # CustomDocumentProperties but its late-bound Item getter fails.
        props=ET.fromstring(z.read('docProps/custom.xml'))
        batches=[''.join(p.itertext()) for p in props if p.get('name')=='DocReportReviewId']
        if batches!=[session['batchId']]:raise RuntimeError('Returned file does not match this review batch')
        batch=batches[0]
    snapshot=output/'returned.docx';snapshot.write_bytes(data)
    shutil.copy2(Path(__file__),output/'readback.snapshot.py')
    mapping=session['bookmarkToSourceId'];revisions=[];comments=[]
    with word_application() as word:
        with opened_document(word,snapshot,True) as doc:
            state=dict(trackRevisions=bool(doc.TrackRevisions),protectionType=int(doc.ProtectionType),batchId=batch)
            anchors=[]
            for b in doc.Bookmarks:
                if b.Name not in mapping:continue
                rng=b.Range
                anchors.append(dict(name=b.Name,sourceId=mapping[b.Name],start=rng.Start,end=rng.End,story=rng.StoryType))
            def locate(rng):
                start,end,story=rng.Start,rng.End,rng.StoryType
                candidates=[b for b in anchors if b['story']==story and b['start']<=start and b['end']>=end]
                candidates.sort(key=lambda b:(b['end']-b['start'],not b['name'].endswith('_b')))
                try:context=rng.Paragraphs.First.Range.Text
                except Exception:context=''
                return dict(start=start,end=end,storyType=story,sourceId=candidates[0]['sourceId'] if candidates else None,
                            mapping='containing-bookmark' if candidates else 'unmapped',paragraphContext=context)
            for story_index,story in enumerate(story_ranges(doc)):
                for revision in story.Revisions:
                    value=dict(type=int(revision.Type),author=str(revision.Author),date=str(revision.Date),
                               text=revision.Range.Text,storyIndex=story_index,**locate(revision.Range))
                    desc=optional(revision,'FormatDescription')
                    if desc:value['formatDescription']=str(desc)
                    revisions.append(value)
            for comment in doc.Comments:
                comments.append(dict(author=str(comment.Author),date=str(comment.Date),text=comment.Range.Text,
                                     scopeText=comment.Scope.Text,**locate(comment.Scope)))
    before,after=package(baseline),package(snapshot)
    differences=[]
    for tag,a,b,c,d in SequenceMatcher(a=before['acceptedParagraphs'],b=after['acceptedParagraphs'],autojunk=False).get_opcodes():
        if tag!='equal':differences.append(dict(operation=tag,baselineParagraphIndex=[a,b],returnedParagraphIndex=[c,d],
                                              before=before['acceptedParagraphs'][a:b],after=after['acceptedParagraphs'][c:d]))
    result=dict(status='readback-complete-not-merged',baselineSha256=session['baselineSha256'],returnedSha256=digest(snapshot),
                changed=digest(snapshot)!=session['baselineSha256'],state=state,revisionCount=len(revisions),commentCount=len(comments),
                revisions=revisions,comments=comments,xmlRevisions=after['xmlRevisions'],acceptedTextDifferences=differences,
                rejectedParagraphTextsEqualBaseline=after['rejectedParagraphs']==before['acceptedParagraphs'],
                embeddedPayloadsEqual=Counter(before['embeddedPayloads'].values())==Counter(after['embeddedPayloads'].values()),
                mediaPayloadsEqual=Counter(before['mediaPayloads'].values())==Counter(after['mediaPayloads'].values()),
                boundary='Text projections do not fully resolve paragraph-mark/table-structure revisions. OLE differences require formula readback. Source JSON is unchanged; nothing is automatically accepted.')
    write(output/'readback.json',result)
    lines=['# 审阅稿回读','',f"修订：{len(revisions)}；批注：{len(comments)}。此结果尚未合入 JSON。",'']
    for i,r in enumerate(revisions,1):
        label={1:'插入',2:'删除',3:'属性变化',4:'段落编号',5:'域显示',6:'已协调冲突',7:'冲突',8:'样式变化',9:'替换',10:'段落属性',11:'表格属性',12:'节属性',13:'样式定义',14:'移出',15:'移入',16:'单元格插入',17:'单元格删除',18:'单元格合并',19:'单元格拆分',20:'冲突插入',21:'冲突删除'}.get(r['type'],f"类型 {r['type']}")
        lines.extend([f"{i}. {label}；源元素：`{r['sourceId'] or '待定位'}`；作者：{r['author']}",f"   内容：{r['text']!r}",''])
    for c in comments:lines.extend([f"批注（{c['author']}）：{c['text']}",f"对应原文：{c['scopeText']}",''])
    (output/'readback.md').write_text('\n'.join(lines),encoding='utf-8')
    evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True)
    for name in ('readback.json','readback.md','readback.snapshot.py'):shutil.copy2(output/name,evidence/name)
    write(evidence/'artifact-hashes.json',dict(returnedPath=str(snapshot),returnedSha256=digest(snapshot),baselinePath=str(baseline),baselineSha256=digest(baseline)))
    print(json.dumps(dict(output=str(output),revisionCount=len(revisions),commentCount=len(comments),
                         embeddedPayloadsEqual=result['embeddedPayloadsEqual'],status=result['status'])))


if __name__=='__main__':main()

"""Read saved UI-created comments and replies; preserve user-owned Word windows."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import shutil
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from word_session import word_application,opened_document

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
WP='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
W15='{http://schemas.microsoft.com/office/word/2012/wordml}'
W14='{http://schemas.microsoft.com/office/word/2010/wordml}'
EXPECTED={
 '【批注测试-正文】请补充这一段的验收依据；这是审阅意见，不直接修改正文。',
 '【批注测试-公式】请核对式（1-1）末尾的 123123 是否为测试残留，并说明变量含义。',
 '【批注测试-图片】图 1 已调整为约 10.65×5.67 cm，请确认宽高比例是否应保留。',
 '【批注测试-回复】收到，后续补充验收条目；这条回复暂不代表正文已经修改。',
}


def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def write(p,data):Path(p).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(p):return sha256(Path(p).read_bytes()).hexdigest()


def package(p):
    with ZipFile(p) as z:
        assert z.testzip() is None
        main=ET.fromstring(z.read('word/document.xml'))
        result=dict(paragraphs=[''.join(n.text or '' for n in p.iter() if n.tag in (W+'t',W+'delText')) for p in main.iter(W+'p')],
            imageExtents=[n.attrib for n in main.iter(WP+'extent')],
            payloads={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith(('word/embeddings/','word/media/'))},
            comments=[],threads=[])
        if 'word/comments.xml' in z.namelist():
            for c in ET.fromstring(z.read('word/comments.xml')):
                result['comments'].append(dict(id=c.get(W+'id'),author=c.get(W+'author'),date=c.get(W+'date'),
                    text=''.join(t.text or '' for t in c.iter(W+'t')),
                    paragraphIds=[p.get(W14+'paraId') for p in c.iter(W+'p') if p.get(W14+'paraId')]))
        if 'word/commentsExtended.xml' in z.namelist():
            for c in ET.fromstring(z.read('word/commentsExtended.xml')):
                result['threads'].append(dict(paraId=c.get(W15+'paraId'),parentParaId=c.get(W15+'paraIdParent'),done=c.get(W15+'done')))
        return result


def optional(fn):
    try:return fn()
    except Exception as exc:return {'unavailable':type(exc).__name__}


def main():
    p=argparse.ArgumentParser(__doc__);p.add_argument('--session',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    args=p.parse_args();session=read(args.session/'session.json');output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Use a fresh out/ child')
    output.mkdir(parents=True,exist_ok=False)
    live=Path(session['testPath']);baseline=Path(session['baselinePath'])
    data=live.read_bytes();assert sha256(data).hexdigest()==digest(live)
    snapshot=output/'saved-comments.docx';snapshot.write_bytes(data)
    rows=[]
    with word_application() as word:
        with opened_document(word,snapshot,True) as doc:
            bookmarks=[]
            for b in doc.Bookmarks:
                source=session['bookmarkToSourceId'].get(b.Name)
                if source:bookmarks.append(dict(name=b.Name,sourceId=source,start=b.Range.Start,end=b.Range.End,story=int(b.Range.StoryType)))
            for c in doc.Comments:
                scope=c.Scope;start,end,story=scope.Start,scope.End,int(scope.StoryType)
                ancestors=optional(lambda: c.Ancestor.Index if c.Ancestor is not None else None)
                candidates=[b for b in bookmarks if b['story']==story and b['start']<=start and b['end']>=end]
                shapes=[]
                for s in scope.InlineShapes:
                    item=dict(type=int(s.Type),start=s.Range.Start,end=s.Range.End,alt=s.AlternativeText,widthPt=s.Width,heightPt=s.Height)
                    if s.Type==1:item['progId']=s.OLEFormat.ProgID
                    shapes.append(item)
                rows.append(dict(index=int(c.Index),author=str(c.Author),date=str(c.Date),text=c.Range.Text,
                    scopeText=scope.Text,start=start,end=end,storyType=story,
                    sourceCandidates=candidates,scopeShapes=shapes,
                    precedingContext=doc.Range(max(0,start-90),start).Text if story==1 else None,
                    followingContext=doc.Range(end,min(doc.Content.End,end+110)).Text if story==1 else None,
                    ancestorIndex=ancestors,replyCount=int(c.Replies.Count),
                    replies=[int(c.Replies.Item(i).Index) for i in range(1,c.Replies.Count+1)],done=optional(lambda:bool(c.Done))))
            state=dict(comments=int(doc.Comments.Count),revisions=int(doc.Revisions.Count),trackRevisions=bool(doc.TrackRevisions),
                protectionType=int(doc.ProtectionType),pages=int(doc.ComputeStatistics(2)),wordVersion=word.Version,wordBuild=word.Build)
    before,after=package(baseline),package(snapshot)
    para_to_comment={p:c['id'] for c in after['comments'] for p in c['paragraphIds']}
    relations=[dict(commentId=para_to_comment[t['paraId']],parentCommentId=para_to_comment.get(t['parentParaId']),done=t['done']) for t in after['threads']]
    checks=dict(expectedTexts=set(c['text'] for c in rows)==EXPECTED,
        bodyParagraphsUnchanged=before['paragraphs']==after['paragraphs'],imageDimensionsUnchanged=before['imageExtents']==after['imageExtents'],
        imageAndOlePayloadsUnchanged=Counter(before['payloads'].values())==Counter(after['payloads'].values()),
        sourceFileUnchanged=digest(session['sourcePath'])==session['sourceSha256'],
        xmlTextsMatch=set(c['text'] for c in after['comments'])==EXPECTED,
        replyRelationshipPersisted=sum(bool(t['parentParaId']) for t in after['threads'])==1,
        comReplyCollectionsConsistent=[r['replyCount'] for r in rows]==[1,0,0,0] and rows[0]['replies']==[2] and rows[1]['ancestorIndex']==1,
        revisionModePreserved=state['trackRevisions'] and state['protectionType']==0 and state['revisions']==3)
    result=dict(status='passed' if all(checks.values()) else 'failed',state=state,checks=checks,comments=rows,
        xmlComments=after['comments'],xmlThreads=after['threads'],threadRelations=relations,docxSha256=digest(snapshot),
        baselineSha256=digest(baseline),creation='Word UI creates 3 root comments and 1 reply; COM fills exact text after a clipboard input failure.',
        boundary='Agent interprets comments and source candidates. No JSON merge or body changes. Same-author local test; resolved threads and multiple reviewers not tested.')
    write(output/'readback.json',result)
    shutil.copy2(__file__,output/'readback.snapshot.py')
    evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True,exist_ok=False)
    for name in ['readback.json','readback.snapshot.py']:shutil.copy2(output/name,evidence/name)
    write(evidence/'artifact-hashes.json',dict(docxPath=str(snapshot),docxSha256=digest(snapshot),baselinePath=str(baseline),baselineSha256=digest(baseline)))
    print(json.dumps({'status':result['status'],'state':state,'checks':checks,'comments':rows},ensure_ascii=False))
    if not all(checks.values()):raise AssertionError('Comment readback check failed')


if __name__=='__main__':main()

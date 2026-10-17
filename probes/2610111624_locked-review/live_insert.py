"""User-authorized COM insertion in the already open review document; never save/close."""
import argparse
from datetime import datetime,timezone
from hashlib import sha256
import json
from pathlib import Path
import shutil
from word_session import configure_com_cache

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
TEXT='【COM 修订测试 01】这句话由自动化直接添加，用于验证 Word 是否记录为插入修订。'


def digest(path):return sha256(path.read_bytes()).hexdigest()
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--session',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Use fresh out/ child')
    output.mkdir(parents=True,exist_ok=False)
    session=json.loads((args.session/'session.json').read_text(encoding='utf-8'))
    path=Path(session['reviewPath']);configure_com_cache()
    import win32com.client
    # Attach only. No DispatchEx, Documents.Open, Quit, Close, Save, or Unprotect.
    word=win32com.client.GetActiveObject('Word.Application')
    matches=[d for d in word.Documents if Path(d.FullName).resolve()==path.resolve()]
    if len(matches)!=1:raise RuntimeError('Expected review file is not uniquely open in this Word instance')
    doc=matches[0]
    if not doc.TrackRevisions or doc.ProtectionType!=0 or doc.ReadOnly:
        raise RuntimeError('Expected editable document with locked revisions')
    if TEXT in doc.Content.Text:raise RuntimeError('Test sentence is already present; refusing duplicate insertion')
    before=dict(saved=bool(doc.Saved),revisions=int(doc.Revisions.Count),diskSha256=digest(path),
                trackRevisions=bool(doc.TrackRevisions),protectionType=int(doc.ProtectionType))
    write(output/'before.json',before);shutil.copy2(__file__,output/'live_insert.snapshot.py')
    position=doc.Content.End-1
    insertion=doc.Range(position,position)
    insertion.InsertAfter('\r'+TEXT)
    revisions=[dict(type=int(r.Type),text=r.Range.Text,author=str(r.Author),date=str(r.Date),
                    start=int(r.Range.Start),end=int(r.Range.End)) for r in doc.Revisions if TEXT in r.Range.Text]
    after=dict(saved=bool(doc.Saved),revisions=int(doc.Revisions.Count),diskSha256=digest(path),
               trackRevisions=bool(doc.TrackRevisions),protectionType=int(doc.ProtectionType))
    result=dict(status='observed',document=str(path),observedAt=datetime.now(timezone.utc).isoformat(),
        insertedText=TEXT,before=before,after=after,matchingRevisions=revisions,
        insertionTracked=bool(revisions) and all(r['type']==1 for r in revisions),
        diskUnchanged=before['diskSha256']==after['diskSha256'],
        policy='Attached to the user-requested open document. InsertAfter only; no save, close, accept/reject, unlock, or tracking toggle. Author is the current Word user, not a distinct automation identity.')
    write(output/'result.json',result)
    evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True,exist_ok=False)
    for name in ['before.json','result.json','live_insert.snapshot.py']:shutil.copy2(output/name,evidence/name)
    if not result['insertionTracked']:raise RuntimeError('The insertion was not recorded as expected; document left open for inspection')
    # Show the insertion in the existing window, without changing display settings.
    doc.Activate();insertion.Select();doc.ActiveWindow.ScrollIntoView(insertion,True)
    print(json.dumps(result,ensure_ascii=True))


if __name__=='__main__':main()

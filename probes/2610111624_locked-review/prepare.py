"""Prepare a locked tracked-changes copy and open it in actual Microsoft Word."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import time
from uuid import uuid4
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from word_session import word_application, opened_document

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]


def write(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def digest(path):return sha256(path.read_bytes()).hexdigest()


def main():
    p=argparse.ArgumentParser(__doc__);p.add_argument('--out',type=Path,required=True)
    args=p.parse_args();output=args.out.resolve()
    if output==ROOT/'out' or not output.is_relative_to(ROOT/'out'):raise ValueError('Output must be a fresh child of out/')
    output.mkdir(parents=True,exist_ok=False)
    source=HERE/'fixture/report.docx';review=output/'导师审阅试验.docx'
    shutil.copy2(source,review);shutil.copy2(HERE/'fixture/content.json',output/'content-baseline.json')
    password=secrets.token_urlsafe(24);batch=str(uuid4())
    # This local test key is intentionally NOT included in Git evidence or logs.
    write(output/'unlock-key.json',dict(password=password))
    with word_application() as word:
        executable=Path(word.Path)/'WINWORD.EXE'
        with opened_document(word,review) as doc:
            if doc.Revisions.Count or doc.Comments.Count:raise RuntimeError('Fixture must start without revisions or comments')
            doc.CustomDocumentProperties.Add('DocReportReviewId',False,4,batch)
            doc.TrackRevisions=True
            doc.Protect(Type=0,Password=password)
            doc.ActiveWindow.View.ShowRevisionsAndComments=True
            doc.ActiveWindow.View.RevisionsView=0
            doc.ActiveWindow.View.RevisionsMode=1
            doc.Save()
            deadline=time.perf_counter()+20
            while word.BackgroundSavingStatus:
                if time.perf_counter()>deadline:raise TimeoutError('Background save')
                time.sleep(.02)
        with opened_document(word,review,True) as doc:
            state=dict(trackRevisions=bool(doc.TrackRevisions),protectionType=int(doc.ProtectionType),
                       revisions=int(doc.Revisions.Count),comments=int(doc.Comments.Count),pages=int(doc.ComputeStatistics(2)),
                       wordVersion=str(word.Version),wordBuild=str(word.Build))
            if not state['trackRevisions'] or state['protectionType']!=0 or state['pages']!=10:
                raise RuntimeError('Persisted revision protection or page count mismatch')
    shutil.copy2(review,output/'baseline.docx')
    content=json.loads((output/'content-baseline.json').read_text(encoding='utf-8'))
    mapping={}
    def visit(value):
        if isinstance(value,dict):
            if 'id' in value:
                base='DR_'+sha256(value['id'].encode()).hexdigest()[:28]
                for suffix in ('','_b','_t','_n','_h','_k'):mapping[base+suffix]=value['id']
                mapping['MT_'+base]=value['id']
            for child in value.values():visit(child)
        elif isinstance(value,list):
            for child in value:visit(child)
    visit(content)
    write(output/'session.json',dict(batchId=batch,reviewPath=str(review),baselinePath=str(output/'baseline.docx'),
        baselineSha256=digest(output/'baseline.docx'),sourceSha256=digest(source),state=state,bookmarkToSourceId=mapping,
        status='awaiting-human-edit-and-save',keyFile='unlock-key.json'))
    evidence=HERE/'evidence'/output.name;evidence.mkdir(parents=True)
    shutil.copy2(output/'session.json',evidence/'session.json')
    shutil.copy2(Path(__file__),evidence/'prepare.snapshot.py')
    subprocess.Popen([str(executable),'/n',str(review)])
    print(json.dumps(dict(openedPath=str(review),state=state,batchId=batch),ensure_ascii=True))


if __name__=='__main__':main()

"""Independent saved-file check of numbering, reference targets and retained objects."""
import argparse
from pathlib import Path
import re
import shutil
import sys
from word_io import read,write,digest,bookmark,FIX,HERE
from object_reader import inventory
from word_session import word_application,opened_document


def main():
    parser=argparse.ArgumentParser(__doc__);parser.add_argument('--run',type=Path,required=True)
    args=parser.parse_args();folder=args.run.resolve();path=folder/'merged-report/merged.docx'
    refs=[]
    with word_application() as word:
        with opened_document(word,path,True) as doc:
            expected={'eq-edit':'1-1','eq-stable':'2-1','fig-stable':'1','tbl-values':'1'}
            numbers={i:doc.Bookmarks.Item(bookmark(i,'_n')).Range.Text.strip() for i in expected}
            assert numbers==expected,(numbers,expected)
            for f in doc.Fields:
                match=re.match(r'\s*REF\s+(\S+)',f.Code.Text)
                if match:
                    name=match[1];target=doc.Bookmarks.Item(name).Range.Text.strip();actual=f.Result.Text.strip()
                    assert actual==target,(name,actual,target)
                    refs.append(dict(bookmark=name,value=actual))
                assert not re.search(r'(Error!|错误[!！])',f.Result.Text,re.I)
            assert len(refs)==14 and doc.TablesOfContents.Count==1
            state=dict(status='passed',numbers=numbers,references=refs,referenceCount=len(refs),
                tocCount=doc.TablesOfContents.Count,wordVersion=word.Version,wordBuild=word.Build,python=sys.version)
    mapping=read(FIX/'session.json')['bookmarkToSourceId']
    old,new=inventory(FIX/'returned.docx',mapping),inventory(path,mapping)
    assert {tuple(n['sourceIds']):n['sha256'] for n in old['objects']}=={tuple(n['sourceIds']):n['sha256'] for n in new['objects']}
    assert [n['sha256'] for n in old['drawings']]==[n['sha256'] for n in new['drawings']]
    state.update(docxSha256=digest(path),retainedFromActualReturn=True)
    write(folder/'field-verification.json',state)
    evidence=HERE/'evidence'/folder.name
    shutil.copy2(folder/'field-verification.json',evidence/'field-verification.json')
    shutil.copy2(__file__,evidence/'verify_fields.snapshot.py')
    print('PASS: 14 cross-references, 4 numbered objects, TOC and actual returned OLE/image payloads')


if __name__=='__main__':main()

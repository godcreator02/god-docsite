"""Edit/reopen an independent native-equation QA copy, never the deliverable."""
import argparse,json,shutil
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from word_com import word_application,opened_document
def main():
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('out',type=Path);a=ap.parse_args()
    root=Path(__file__).resolve().parents[2]
    if not a.out.resolve().is_relative_to(root/'out'):raise ValueError('QA copy must be in out/')
    a.out.mkdir(parents=True,exist_ok=False)
    copy=a.out/'native-equation-edit.docx';shutil.copy2(a.source,copy)
    with word_application() as word:
        with opened_document(word,copy.resolve()) as doc:
            before=doc.OMaths.Count
            equation=doc.OMaths.Item(5)
            r=equation.Range.Duplicate
            assert r.Find.Execute(FindText='8',Wrap=0)
            r.Text='9'
            doc.Save()
        with opened_document(word,copy.resolve(),True) as doc:
            assert doc.OMaths.Count==before
            assert '9' in doc.OMaths.Item(5).Range.Text
    ns={'m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
    with ZipFile(copy) as z:
        xml=E.fromstring(z.read('word/document.xml'))
        formula=xml.findall('.//m:oMath',ns)[4]
        denominator=''.join(formula.xpath('.//m:f/m:den//m:t/text()',namespaces=ns))
        assert denominator=='9fsL',denominator
    record={'edit':'native fraction denominator 8 -> 9','nativeEquationsAfterReopen':before,'denominatorAfterReopen':denominator,'sourceUnmodified':True}
    (a.out/'verification.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(record,ensure_ascii=False))
if __name__=='__main__':main()

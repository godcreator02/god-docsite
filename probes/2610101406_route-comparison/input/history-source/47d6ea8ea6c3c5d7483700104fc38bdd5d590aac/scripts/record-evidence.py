from pathlib import Path
from zipfile import ZipFile
from lxml import etree
import hashlib,json,sys,platform,importlib.metadata
ROOT=Path(__file__).resolve().parents[1]; OUT=Path(sys.argv[1])
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks=[]
for route in ['word-com','pandoc','direct-docx']:
    records=[]
    for suffix in ['', '.edit-check']:
        with ZipFile(OUT/(route+suffix+'.docx')) as z:
            xml=etree.fromstring(z.read('word/document.xml'));math=xml.findall('.//m:oMath',ns)
            den=math[1].find('.//m:den',ns)
            records.append({'mathCount':len(math),'denominator':''.join(den.itertext())})
    assert records[0]['mathCount']==records[1]['mathCount']==6
    assert records[0]['denominator'].endswith('1') and records[1]['denominator'].endswith('2'),records
    checks.append({'route':route,'original':records[0],'editedAndReopened':records[1],'passed':True})
manifest={'runDirectory':str(OUT),'fixtureSha256':sha(ROOT/'fixtures/canonical.json'),
          'sourceTemplateSha256':sha(ROOT/'templates/sgcc-feasibility-2018-original.docx'),
          'requirementsSha256':sha(ROOT/'requirements.txt'),
          'python':{'executable':sys.executable,'version':platform.python_version(),'packages':{p:importlib.metadata.version(p) for p in ['python-docx','lxml','pypdf','Pillow','pywin32']}},
          'scripts':{str(p.relative_to(ROOT)):sha(p) for folder in ['routes','scripts'] for p in (ROOT/folder).rglob('*') if p.suffix in ['.py','.txt']},
          'editAssertions':checks,
          'verifiedScope':['Word open/save/reopen','Word denominator edit and reopen','6 OMML formulas','40 data rows plus repeating header','5 pages each inspected at 110 dpi'],
          'notTested':['MathType OLE','all six equation types edited','insert-before numbering test','append-row pagination test','cold and repeated benchmark','other Word/WPS versions']}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(checks,ensure_ascii=False,indent=2))

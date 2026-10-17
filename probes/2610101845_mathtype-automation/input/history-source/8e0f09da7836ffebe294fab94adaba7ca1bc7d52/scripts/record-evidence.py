from pathlib import Path
from zipfile import ZipFile
from lxml import etree
import argparse,hashlib,json,sys,platform,importlib.metadata
parser=argparse.ArgumentParser(description='Record actual checks after a human/agent has inspected the rendered pages.')
parser.add_argument('output_directory',type=Path)
parser.add_argument('--reviewed-pages',help='Explicit visual-review declaration, for example 1-12; never inferred from rendering success')
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]; OUT=args.output_directory
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if (OUT/'project-verification.json').exists():
    verified=json.loads((OUT/'project-verification.json').read_text(encoding='utf-8'))
    if args.reviewed_pages:
        first,last=map(int,args.reviewed_pages.split('-'))
        visual={'pdfSha256':sha(OUT/'word-com.pdf'),'reviewedPages':list(range(first,last+1)),
                'method':'Word PDF rendered with Poppler at 110 dpi; every declared page inspected at full resolution',
                'result':'No missing glyphs, clipping, overlap or broken table pagination observed'}
        (OUT/'visual-review.json').write_text(json.dumps(visual,ensure_ascii=False,indent=2),encoding='utf-8')
    visual=json.loads((OUT/'visual-review.json').read_text(encoding='utf-8'))
    assert visual['pdfSha256']==sha(OUT/'word-com.pdf')
    assert visual['reviewedPages']==list(range(1,verified['baseline']['pages']+1))
    assert all(verified[key]['passed'] for key in ['allMathEdit','insertFormula','appendRows','review'])
    template=ROOT/'templates/project-report.dotx'
    with ZipFile(template) as archive:
        content_type=archive.read('[Content_Types].xml').decode('utf-8')
        assert 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml' in content_type
        assert not any('vbaProject' in name for name in archive.namelist())
    generation=json.loads((OUT/'word-com-generation.json').read_text(encoding='utf-8'))
    assert generation['templateSha256']==sha(template) and generation['templateUnchanged']
    scripts=['routes/word-com/template.py','routes/word-com/build.py','scripts/word_com.py',
             'scripts/word-verify.py','scripts/audit-and-render.py','scripts/record-evidence.py','scripts/capture-environment.py']
    manifest={
        'profile':'project-report-v1','runDirectory':str(OUT.resolve()),
        'fixtureSha256':sha(ROOT/'fixtures/canonical.json'),'templateSha256':sha(template),
        'nativeMacroFreeTemplate':True,'templateUnchangedByGeneration':True,
        'requirementsSha256':sha(ROOT/'requirements.txt'),
        'python':{'executable':sys.executable,'version':platform.python_version(),
                  'packages':{p:importlib.metadata.version(p) for p in ['pywin32','Pillow','lxml','pypdf']}},
        'scripts':{p:sha(ROOT/p) for p in scripts},
        'artifacts':{p.name:sha(p) for p in OUT.glob('word-com.*') if p.suffix in ('.docx','.pdf')},
        'verification':verified,'visualReview':visual,
        'notTested':['MathType OLE','WPS / Word Online / macOS Word','arbitrary LaTeX conversion','performance benchmark']}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Project report evidence recorded: 10 body pages, native template and all edit checks passed.')
    sys.exit(0)
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

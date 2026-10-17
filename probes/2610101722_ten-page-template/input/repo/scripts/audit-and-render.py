"""Inspect the actual Word outputs and rasterize Word PDFs using bundled Poppler."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw
import json, sys, hashlib, subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]); POPPLER=Path(sys.argv[2])
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
results=[]
for route in ['word-com','pandoc','direct-docx']:
    path=OUT/(route+'.docx')
    if not path.exists():continue
    with ZipFile(path) as z:
        root=etree.fromstring(z.read('word/document.xml'))
        record={'route':route,'sha256':sha(path),'mathCount':len(root.findall('.//m:oMath',NS)),
                'fractions':len(root.findall('.//m:f',NS)),'integrals':len(root.findall('.//m:nary',NS)),
                'matrices':len(root.findall('.//m:m',NS)),'equationArrays':len(root.findall('.//m:eqArr',NS)),
                'noSplitRows':len(root.findall('.//w:cantSplit',NS)),
                'repeatHeaders':len(root.findall('.//w:tblHeader',NS)),
                'oleObjects':len(root.findall('.//{urn:schemas-microsoft-com:office:office}OLEObject')),
                'mathText':[''.join(x.itertext()) for x in root.findall('.//m:oMath',NS)],
                'fields':[''.join(x.itertext()) for x in root.findall('.//w:instrText',NS)]}
    pdf=OUT/(route+'.pdf'); pages=PdfReader(pdf).pages
    record['pages']=len(pages); record['pageText']=[p.extract_text() for p in pages]
    dest=OUT/(route+'-pages');dest.mkdir(exist_ok=True)
    subprocess.run([str(POPPLER/'pdftoppm.exe'),'-png','-r','110',str(pdf),str(dest/'page')],check=True,capture_output=True)
    images=[]
    for p in sorted(dest.glob('page-*.png')):
        img=Image.open(p).convert('RGB');img.thumbnail((420,594));canvas=Image.new('RGB',(440,624),'#dddddd');canvas.paste(img,((440-img.width)//2,20));ImageDraw.Draw(canvas).text((10,607),p.name,fill='black');images.append(canvas)
    columns=min(4,len(images))
    sheet=Image.new('RGB',(440*columns,624*((len(images)+columns-1)//columns)),'white')
    for i,img in enumerate(images):sheet.paste(img,(440*(i%columns),624*(i//columns)))
    sheet.save(OUT/(route+'-contact.png'))
    results.append(record)
(OUT/'structure-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in x.items() if k not in ['mathText','pageText','fields']} for x in results],ensure_ascii=False,indent=2))

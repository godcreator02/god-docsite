"""Independent structural/content checks against the captured source AST."""
import argparse, hashlib, json, re, unicodedata
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from pypdf import PdfReader
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
XSL=E.XSLT(E.parse('C:/Program Files/Microsoft Office/root/Office16/MML2OMML.XSL'))
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
def bookmark_count(items):return sum(bookmark_count(x) if isinstance(x,list) else 1 for x in items)
def converted(node):
    xml=E.fromstring(node['mathml'].encode())
    m=xml.find('.//{http://www.w3.org/1998/Math/MathML}math')
    for a in m.findall('.//{http://www.w3.org/1998/Math/MathML}annotation'):a.getparent().remove(a)
    return XSL(m).getroot()
def flatten(node):
    if node['type'] in ('math','inlineMath'):return ''.join(converted(node).xpath('.//m:t/text()',namespaces=NS))
    if node['type'] in ('text','inlineCode','code'):return node['value']
    return ''.join(flatten(c) for c in node.get('children',[]))
def walk(node):
    yield node
    for c in node.get('children',[]):yield from walk(c)
def semantic(el):
    tag=E.QName(el).localname
    if tag.endswith('Pr'):return None
    if tag=='r':return ('text',''.join(el.xpath('.//m:t/text()',namespaces=NS)))
    if tag=='t':return (tag,el.text or '')
    children=[v for c in el if (v:=semantic(c)) is not None]
    merged=[]
    for child in children:
        if child[0]=='text' and merged and merged[-1][0]=='text':merged[-1]=('text',merged[-1][1]+child[1])
        else:merged.append(child)
    return (tag,merged)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('out',type=Path);a=ap.parse_args();d=a.out
    ast=json.loads((d/'ast.json').read_text('utf-8')); manifest=json.loads((d/'verification.json').read_text('utf-8'))
    with ZipFile(d/'sst-collab-report.docx') as z:
        root=E.fromstring(z.read('word/document.xml'))
        tables=root.findall('.//w:body/w:tbl',NS)
        wanted=[n for n in walk(ast) if n['type']=='table']
        assert len(tables)==len(wanted)
        cells=0
        for actual,expected in zip(tables,wanted):
            rows=actual.findall('w:tr',NS)
            assert len(rows)==len(expected['children'])
            assert rows[0].find('w:trPr/w:tblHeader',NS) is not None
            for row,erow in zip(rows,expected['children']):
                actual_cells=row.findall('w:tc',NS)
                assert len(actual_cells)==len(erow['children'])
                for cell,ecell in zip(actual_cells,erow['children']):
                    t=''.join(cell.xpath('.//w:t/text() | .//m:t/text()',namespaces=NS))
                    assert norm(t)==norm(flatten(ecell)),(t,flatten(ecell))
                    cells+=1
        equations=root.findall('.//m:oMath',NS)
        expected_math=[n for n in walk(ast) if n['type'] in ('inlineMath','math')]
        assert len(equations)==len(expected_math)
        math_results=[]
        for actual,node in zip(equations,expected_math):
            same=semantic(actual)==semantic(converted(node))
            assert same,('Changed native expression',node['value'],semantic(actual),semantic(converted(node)))
            math_results.append({'latex':node['value'],'semanticStructureEqual':same})
        parts=[n for n in z.namelist() if n.startswith('word/media/')]
        actual_images=sorted(hashlib.sha256(z.read(n)).hexdigest() for n in parts)
        assert actual_images==sorted(n['sha256'] for n in manifest['images'])
        rels=E.fromstring(z.read('word/_rels/document.xml.rels'))
        links=[r.get('Target') for r in rels if r.get('Type','').endswith('/hyperlink') and r.get('TargetMode')=='External']
        assert sorted(set(links))==sorted(set(n['url'] for n in manifest['links']))
        all_text=norm(''.join(root.xpath('.//w:t/text() | .//m:t/text()',namespaces=NS)))
        paragraphs=[n for n in ast['children'] if n['type']=='paragraph']
        # The source subtitle is also represented on the title/contents page.
        paragraphs += [p for n in ast['children'] if n['type']=='list' for item in n['children'] for p in item['children']]
        for p in paragraphs:
            if any(c['type']=='image' for c in p.get('children',[])):continue
            assert norm(flatten(p)) in all_text,('Missing source paragraph',flatten(p))
        assert not re.search(r'ZZ(?:MATH|SEQ|TOC|LINK)',all_text)
        pdf=PdfReader(d/'sst-collab-report.pdf')
        result={'allTableCellsMatch':cells,'mathExpressionsMatch':len(equations),'math':math_results,
                'imageBytesMatch':len(parts),'externalLinkTargetsMatch':len(set(links)),
                'sourceParagraphsChecked':len(paragraphs),'pdfPages':len(pdf.pages),
                'landscapePages':[i+1 for i,p in enumerate(pdf.pages) if p.mediabox.width>p.mediabox.height],
                'pdfHeadingBookmarks':bookmark_count(pdf.outline)}
        (d/'content-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({k:v for k,v in result.items() if k!='math'},ensure_ascii=False))
if __name__=='__main__':main()

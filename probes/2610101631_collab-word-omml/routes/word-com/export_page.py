"""Render the saved collaborative report through native Microsoft Word COM.

The input is MDX's constrained Markdown/math subset, parsed by remark. Math is
converted from the same LaTeX through KaTeX MathML and Office's own XSLT to OMML.
No source DOCX, Pandoc, screenshots, or hardcoded formula mappings are involved.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import faulthandler
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
from word_com import word_application, opened_document, utf16_length

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_SOURCE=ROOT/'site/pages/report/sst-sample/page.mdx'
DEFAULT_NODE=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
MML_XSL=Path('C:/Program Files/Microsoft Office/root/Office16/MML2OMML.XSL')
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
def mm(n): return n*72/25.4
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def uncompressed_template(word,out):
    """Set a DOCX-only image option that Word's COM model does not expose."""
    blank=word.Documents.Add(); original=out/'word-blank.docx'
    blank.SaveAs2(str(original),FileFormat=16); blank.Close(0)
    target=out/'word-template.docx'
    with ZipFile(original) as before, ZipFile(target,'w',ZIP_DEFLATED) as after:
        for name in before.namelist():
            data=before.read(name)
            if name=='word/settings.xml':
                root=E.fromstring(data)
                setting=root.find('w:doNotAutoCompressPictures',NS)
                if setting is None:setting=E.SubElement(root,'{'+NS['w']+'}doNotAutoCompressPictures')
                setting.set('{'+NS['w']+'}val','true')
                data=E.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
            after.writestr(name,data)
    return target

def validate_ast(node):
    supported={'root','heading','paragraph','text','strong','emphasis','inlineCode','code','list','listItem','table','tableRow','tableCell','image','link','inlineMath','math','html','break'}
    if node['type'] not in supported: raise ValueError('Unsupported report node: '+node['type'])
    if node['type']=='html' and not re.fullmatch(r'<!-- section:[a-z-]+ -->',node['value']):
        raise ValueError('Only section markers are permitted in report HTML')
    for child in node.get('children',[]): validate_ast(child)

class Composer:
    def __init__(self,doc,source,layout):
        self.doc,self.source,self.layout=doc,source,layout
        self.math=[]; self.links=[]; self.images=[]; self.tables=[]; self.formats=[]
        self.section=''; self.landscape=False; self.transform=E.XSLT(E.parse(str(MML_XSL)))
        self.equation_index=0

    def style(self,key,size,bold=False):
        s=self.doc.Styles.Item(key)
        s.Font.Name='Times New Roman'; s.Font.NameFarEast=self.layout['font']
        s.Font.Size=size; s.Font.Bold=-1 if bold else 0; s.Font.Color=0
        s.Font.Italic=0
        p=s.ParagraphFormat; p.SpaceBefore=0; p.SpaceAfter=6; p.FirstLineIndent=0
        p.LineSpacingRule=1; p.KeepWithNext=0; p.WidowControl=-1
        return p

    def setup(self):
        p=self.doc.PageSetup
        p.PageWidth=mm(210); p.PageHeight=mm(297)
        for side,value in self.layout['marginsMm'].items(): setattr(p,side.capitalize()+'Margin',mm(value))
        p.HeaderDistance=p.FooterDistance=mm(12.7)
        self.style(-1,self.layout['size']).FirstLineIndent=24
        for key,size in [(-2,15),(-3,12),(-4,12)]:
            p=self.style(key,size,True); p.SpaceBefore=10; p.KeepWithNext=-1
        for name in ['Report Code','Report Equation','Report Subtitle']:
            self.doc.Styles.Add(name,1)
        p=self.style('Report Code',8); p.LineSpacingRule=0; p.SpaceAfter=0
        self.doc.Styles.Item('Report Code').Font.Name='Courier New'
        self.doc.Styles.Item('Report Code').Font.NameFarEast='宋体'
        self.style('Report Equation',12).Alignment=1
        self.style('Report Subtitle',12).Alignment=1
        self.style(-63,24,True).Alignment=1
        self.style(-35,10.5).Alignment=1
        self.style(-32,10.5); self.style(-33,10.5)
        for key in [-20,-21]: self.style(key,10.5)
        section=self.doc.Sections.Item(1)
        section.Headers.Item(1).Range.Text=self.layout['header']
        section.Headers.Item(1).Range.Font.Size=9
        footer=section.Footers.Item(1).Range
        footer.ParagraphFormat.Alignment=1
        self.doc.Fields.Add(footer,33)

    def add(self,text,style=-1):
        start=self.doc.Content.End-1
        self.doc.Range(start,start).InsertAfter(text+'\r')
        r=self.doc.Range(start,start+utf16_length(text)+1); r.Style=self.doc.Styles.Item(style)
        return r

    def flat(self,node):
        kind=node['type']
        if kind in ('text','code'): return node['value']
        if kind in ('strong','emphasis','inlineCode'):
            content=node['value'] if kind=='inlineCode' else ''.join(self.flat(c) for c in node['children'])
            token='ZZFORMAT'+str(len(self.formats)).zfill(4)+'ZZ'
            self.formats.append((token,content,kind)); return token
        if kind in ('inlineMath','math'):
            token='ZZMATH'+str(len(self.math)).zfill(4)+'ZZ'
            self.math.append((token,node)); return token
        if kind=='link':
            if not node['url'].startswith(('https://','http://')): raise ValueError('Unsupported link scheme')
            token='ZZLINK'+str(len(self.links)).zfill(4)+'ZZ'
            label=''.join(self.flat(c) for c in node['children'])
            self.links.append((token,label,node['url'])); return token
        if kind=='break': return '\v'
        return ''.join(self.flat(c) for c in node.get('children',[]))

    def paragraph(self,node,prefix=''):
        if len(node.get('children',[]))==1 and node['children'][0]['type']=='image':
            self.picture(node['children'][0]); return
        text=prefix+self.flat(node)
        caption=bool(re.match(r'^[图表]\s*[A-Z0-9]+-',text)) and (text.startswith('表') or len(text)<60)
        r=self.add(text,-35 if caption else -1)
        if prefix: r.ParagraphFormat.FirstLineIndent=0
        if caption and text.startswith('表'): r.ParagraphFormat.KeepWithNext=-1

    def picture(self,node):
        image=(self.source.parent/node['url']).resolve()
        if not image.is_relative_to(self.source.parent.resolve()) or not image.is_file():
            raise ValueError('Image must be inside report folder: '+node['url'])
        p=self.add(''); p.ParagraphFormat.FirstLineIndent=0; p.ParagraphFormat.Alignment=1; p.ParagraphFormat.KeepWithNext=-1
        r=p.Duplicate; r.End-=1
        pic=self.doc.InlineShapes.AddPicture(str(image),False,True,r)
        pic.LockAspectRatio=-1
        scale=min(mm(165)/pic.Width,mm(self.layout['imageMaxHeightMm'])/pic.Height,1)
        pic.Width*=scale
        pic.AlternativeText=node.get('alt','')
        self.images.append({'path':image.name,'sha256':sha(image)})

    def table(self,node):
        print('Table',len(self.tables)+1,flush=True)
        rows=[[self.flat(c) for c in row['children']] for row in node['children']]
        start=self.doc.Content.End-1
        text='\r'.join('\t'.join(c.replace('\t',' ').replace('\r',' ') for c in row) for row in rows)+'\r'
        self.doc.Range(start,start).InsertAfter(text)
        rng=self.doc.Range(start,start+utf16_length(text))
        t=rng.ConvertToTable(Separator=1,NumRows=len(rows),NumColumns=len(rows[0]),AutoFitBehavior=0)
        t.AllowAutoFit=False
        widths=self.layout['tableWidthsMm'][len(self.tables)]
        if len(widths)!=len(rows[0]): raise ValueError('Wrong table column widths')
        for i,width in enumerate(widths,1): t.Columns.Item(i).Width=mm(width)
        t.Rows.AllowBreakAcrossPages=0; t.Rows.HeadingFormat=0; t.Rows.Item(1).HeadingFormat=-1
        t.Rows.HeightRule=0; t.Rows.SetLeftIndent(0,0)
        t.TopPadding=t.BottomPadding=mm(1.5); t.LeftPadding=t.RightPadding=mm(1.5)
        r=t.Range; r.Font.Name='Times New Roman'; r.Font.NameFarEast=self.layout['font']; r.Font.Size=10.5
        if len(rows[0])>=5: r.Font.Size=10
        f=r.ParagraphFormat; f.FirstLineIndent=0; f.SpaceBefore=f.SpaceAfter=0; f.LineSpacingRule=0; f.KeepWithNext=0
        t.Range.Cells.VerticalAlignment=1
        for border_id in [-1,-2,-3,-4,-5,-6]:
            border=t.Borders.Item(border_id); border.LineStyle=1; border.LineWidth=4; border.Color=0
        t.Rows.Item(1).Range.Font.Bold=-1
        t.Rows.Item(1).Shading.BackgroundPatternColor=15132390
        self.tables.append({'rows':len(rows),'columns':len(rows[0]),'cells':rows})
        self.add('')

    def section_marker(self,value):
        key=re.fullmatch(r'<!-- section:([a-z-]+) -->',value).group(1)
        rule=self.layout['sections'].get(key,{})
        landscape=rule.get('orientation')=='landscape'
        if landscape != self.landscape:
            end=self.doc.Content.End-1; self.doc.Range(end,end).InsertBreak(2)
            section=self.doc.Sections.Item(self.doc.Sections.Count)
            section.PageSetup.Orientation=1 if landscape else 0
            section.PageSetup.PageWidth=mm(297 if landscape else 210)
            section.PageSetup.PageHeight=mm(210 if landscape else 297)
            self.landscape=landscape
        elif rule.get('pageBreak'):
            end=self.doc.Content.End-1; self.doc.Range(end,end).InsertBreak(7)
        self.section=key
        print('Section',key,flush=True)

    def compose(self,tree):
        self.setup()
        self.add(self.layout['title'],-63)
        self.add(self.layout['subtitle'],'Report Subtitle')
        self.add('目录',-63).Font.Size=16
        marker=self.add('ZZTOCZZ'); marker.End-=1
        self.doc.TablesOfContents.Add(marker,True,1,2,UseHyperlinks=True)
        end=self.doc.Content.End-1; self.doc.Range(end,end).InsertBreak(7)
        started=False
        for node in tree['children']:
            kind=node['type']
            if kind=='html': self.section_marker(node['value']); started=True
            elif not started: continue
            elif kind=='heading': self.add(self.flat(node),-2 if node['depth']==2 else -3)
            elif kind=='paragraph': self.paragraph(node)
            elif kind=='code':
                self.add(node['value'].replace('\n','\v'),'Report Code').ParagraphFormat.KeepTogether=-1
            elif kind=='table': self.table(node)
            elif kind=='list':
                for i,item in enumerate(node['children'],node.get('start') or 1):
                    for p in item['children']:
                        if p['type']!='paragraph': raise ValueError('Nested lists not supported by this fixture exporter')
                        self.paragraph(p,(str(i)+'. ') if node['ordered'] else '• ')
            elif kind=='math':
                self.equation_index+=1
                self.add(self.flat(node)+'  (ZZSEQ'+str(self.equation_index)+'ZZ)','Report Equation')
            else: raise ValueError('Unhandled block: '+kind)
        for token,label,url in self.links:
            self.doc.Hyperlinks.Add(self.find(token),url,TextToDisplay=label)
        # Expand outer spans before nested spans; do this before inserting native equations.
        for token,content,kind in reversed(self.formats):
            r=self.find(token);r.Text=content
            if kind=='strong':r.Font.Bold=-1
            elif kind=='emphasis':r.Font.Italic=-1
            else:r.Font.Name='Consolas'
        scratch=self.doc.Application.Documents.Add()
        try:
            package=E.fromstring(scratch.Content.WordOpenXML.encode())
            body=package.find('.//w:body',NS)
            for child in list(body): body.remove(child)
            for token,node in self.math:
                xml=E.fromstring(node['mathml'].encode())
                math=xml.find('.//{http://www.w3.org/1998/Math/MathML}math')
                for annotation in math.findall('.//{http://www.w3.org/1998/Math/MathML}annotation'):
                    annotation.getparent().remove(annotation)
                paragraph=E.SubElement(body,'{'+NS['w']+'}p')
                paragraph.append(self.transform(math).getroot())
            # Word expects a complete Flat OPC package, including its root relationship.
            # A separate native carrier keeps insertion inside table cells and paragraphs safe.
            scratch.Content.InsertXML(E.tostring(package,encoding='unicode'))
            if scratch.OMaths.Count!=len(self.math): raise ValueError('Native math carrier count mismatch')
            for i,(token,node) in enumerate(self.math,1):
                equation=scratch.OMaths.Item(i); equation.Type=1
                target=self.find(token); size=target.Font.Size
                target.FormattedText=equation.Range.FormattedText
                target.Font.Name='Cambria Math'; target.Font.Size=size
        finally: scratch.Close(0)
        for i in range(1,self.equation_index+1):
            field=self.doc.Fields.Add(self.find('ZZSEQ'+str(i)+'ZZ'),-1,'SEQ Equation \\* ARABIC',True)
            self.doc.Bookmarks.Add('Equation_'+str(i),field.Result)
        self.doc.Content.Font.Color=0
        for section in self.doc.Sections:
            footer=section.Footers.Item(1).Range
            footer.ParagraphFormat.Alignment=1; footer.Font.Size=10.5
        self.doc.Fields.Update()
        self.doc.Repaginate()
        for toc in self.doc.TablesOfContents: toc.Update()
        self.doc.Repaginate()
        if re.search(r'ZZ(?:MATH|LINK|SEQ|TOC|FORMAT)',self.doc.Content.Text): raise ValueError('Unresolved marker')

    def find(self,token):
        r=self.doc.Content.Duplicate
        if not r.Find.Execute(FindText=token,Wrap=0): raise ValueError('Missing marker '+token)
        return r

def main():
    faulthandler.dump_traceback_later(60, repeat=True)
    ap=argparse.ArgumentParser(); ap.add_argument('out',type=Path); ap.add_argument('--source',type=Path,default=DEFAULT_SOURCE); ap.add_argument('--node',type=Path,default=DEFAULT_NODE)
    args=ap.parse_args(); out=args.out.resolve(); source=args.source.resolve()
    if not out.is_relative_to(ROOT/'out'): raise SystemExit('Output must be under this lab out/')
    if out.exists(): raise SystemExit('Use a fresh output directory')
    out.mkdir(parents=True)
    started=time.perf_counter()
    layout_path=source.with_name('word-layout.json')
    source_bytes=source.read_bytes(); layout_bytes=layout_path.read_bytes()
    (out/'source.mdx').write_bytes(source_bytes); (out/'word-layout.json').write_bytes(layout_bytes)
    layout=json.loads(layout_bytes)
    subprocess.run([str(args.node),str(ROOT/'site/parse-report.mjs'),str(out/'source.mdx'),str(out/'ast.json')],check=True)
    tree=json.loads((out/'ast.json').read_text(encoding='utf-8')); validate_ast(tree)
    docx=out/'sst-collab-report.docx'; pdf=out/'sst-collab-report.pdf'
    with word_application() as word:
        word.ScreenUpdating=False
        old_pagination=word.Options.Pagination
        try:
            template=uncompressed_template(word,out)
            doc=word.Documents.Open(str(template),AddToRecentFiles=False)
            print('Word ready',flush=True)
            doc.ActiveWindow.View.Type=1; word.Options.Pagination=False
            c=Composer(doc,source,layout); c.compose(tree)
            doc.ActiveWindow.View.Type=3; word.Options.Pagination=old_pagination
            doc.SaveAs2(str(docx),FileFormat=16)
            doc.Close(0)
            with opened_document(word,docx) as final:
                final.Repaginate()
                final.ExportAsFixedFormat(str(pdf),17,OpenAfterExport=False,CreateBookmarks=1)
                checks={'pages':final.ComputeStatistics(2),'nativeEquations':final.OMaths.Count,'tables':final.Tables.Count,'images':final.InlineShapes.Count,
                        'sections':final.Sections.Count,'hyperlinks':final.Hyperlinks.Count,'equationFields':c.equation_index,'toc':final.TablesOfContents.Count}
                if checks['nativeEquations']!=len(c.math): raise ValueError('Equation count differs after reopen')
                if checks['tables']!=len(c.tables) or checks['images']!=len(c.images): raise ValueError('Structural count mismatch')
                final.Save()
        finally: word.Options.Pagination=old_pagination
    evidence={'source':str(source),'sourceSha256':hashlib.sha256(source_bytes).hexdigest(),'layoutSha256':hashlib.sha256(layout_bytes).hexdigest(),'python':sys.executable,
              'mathXslt':str(MML_XSL),'mathXsltSha256':sha(MML_XSL),'checks':checks,'tableDimensions':[{k:t[k] for k in ('rows','columns')} for t in c.tables],
              'mathSource':[n['value'] for _,n in c.math],'images':c.images,'links':[{'label':l,'url':u} for _,l,u in c.links],
              'docxSha256':sha(docx),'pdfSha256':sha(pdf),'seconds':round(time.perf_counter()-started,2)}
    (out/'verification.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    subprocess.run([sys.executable,str(Path(__file__).with_name('verify_export.py')),str(out)],check=True)
    print(json.dumps(evidence,ensure_ascii=False))

if __name__=='__main__': main()

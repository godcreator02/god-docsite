"""Pandoc route: Markdown + reference styles + explicit Word fields, then table constraints."""
import sys, json, subprocess, time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from document_common import *
from lxml import etree

def raw(xml): return '\n```{=openxml}\n'+xml+'\n```\n'
def inline(xml):return '`'+xml+'`{=openxml}'
def fld(code,val='1',bm=None):
    p=element('w:p');field(p,code,val,bm)
    return ''.join(etree.tostring(x,encoding='unicode') for x in p)
TAB='<w:r><w:tab/></w:r>'
BREAK='<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
def build(out,pandoc):
    start=time.perf_counter(); ref=styled_document(); ref.save(ROOT/'templates/sgcc-style-reference.docx')
    c=styled_document();cover(c)
    md=''.join(raw(etree.tostring(x,encoding='unicode')) for x in c.element.body if x.tag!=qn('w:sectPr'))
    md+='\n# 一、'+FIXTURE['headings'][0]['text']+'\n\n'+FIXTURE['paragraphs'][0]['text']+'\n\n'
    para=FIXTURE['paragraphs'][1]
    md+=para['textBeforeEquation']+'$'+FIXTURE['equations'][0]['latex']+'$'+para['textAfterEquation']+'\n\n'
    md+='参见表 '+inline(fld(' REF TableParameters \\h '))+' 和式（'+inline(fld(' REF EqFraction \\h '))+'）。'+FIXTURE['paragraphs'][2]['text']+'\n\n'
    md+='# 二、'+FIXTURE['headings'][1]['text']+'\n\n'
    for n,e in enumerate(FIXTURE['equations'][1:],1):
        if n==3: md+='## （一）'+FIXTURE['headings'][2]['text']+'\n\n'
        md+='::: {custom-style="Equation"}\n'+inline(TAB)+'$'+e['latex']+'$'+inline(TAB)+'（'+inline(fld(' SEQ Equation \\* ARABIC ',str(n),('21','EqFraction') if n==1 else None))+'）\n:::\n\n'
    md+=raw(BREAK)+'\n# 三、'+FIXTURE['headings'][3]['text']+'\n\n'
    md+='::: {custom-style="Caption"}\n表 '+inline(fld(' SEQ Table \\* ARABIC ',bm=('20','TableParameters')))+' '+FIXTURE['table']['caption']+'\n:::\n\n'
    md+='| '+' | '.join(FIXTURE['table']['headers'])+' |\n|:---:|:---:|:---:|:---:|\n'
    for i in range(40):
        row=list(FIXTURE['table']['rows'][i%4]);row[0]+=f' {i+1}';md+='| '+' | '.join(row)+' |\n'
    (out/'pandoc-input.md').write_text(md,encoding='utf-8')
    cmd=[pandoc,str(out/'pandoc-input.md'),'--from=markdown+raw_attribute','--to=docx','--reference-doc='+str(ROOT/'templates/sgcc-style-reference.docx'),'-o',str(out/'pandoc.raw.docx')]
    subprocess.run(cmd,check=True,capture_output=True,text=True)
    generated=time.perf_counter()
    # Pandoc has no Markdown representation for cantSplit/exact column widths; preserve its raw output.
    d=Document(out/'pandoc.raw.docx')
    for t in d.tables:
        t.style='Table Grid'
        t.autofit=False
        for col,w in zip(t.columns,FIXTURE['table']['columnWidthsMm']):col.width=Mm(w)
        for i,row in enumerate(t.rows):
            row._tr.get_or_add_trPr().append(element('w:cantSplit'))
            if i==0:row._tr.get_or_add_trPr().append(element('w:tblHeader'))
            for c,w in zip(row.cells,FIXTURE['table']['columnWidthsMm']):
                c.width=Mm(w)
                for p in c.paragraphs:
                    p.paragraph_format.first_line_indent=Pt(0);p.paragraph_format.space_before=p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=1.5
    d.save(out/'pandoc.prepared.docx')
    (out/'pandoc-generation.json').write_text(json.dumps({'generationSeconds':generated-start,'tableConstraintsSeconds':time.perf_counter()-generated,'command':cmd,'version':subprocess.check_output([pandoc,'--version'],text=True).splitlines()[0]},indent=2),encoding='utf-8')
if __name__=='__main__':build(Path(sys.argv[1]),sys.argv[2])

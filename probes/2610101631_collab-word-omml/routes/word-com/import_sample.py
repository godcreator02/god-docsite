"""One-time, explicit selection from the retained Word report into editable MDX.

This is a fixture importer, not an arbitrary DOCX round-trip converter.
After import, edit page.mdx; export_page.py never reads the original DOCX.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E

ROOT = Path(__file__).resolve().parents[2]
NS = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'm':'http://schemas.openxmlformats.org/officeDocument/2006/math',
      'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
SAMPLE = ROOT / 'site/pages/report/sst-sample'
SOURCE_SHA256 = '4ca6b8fd3e4d00dcbbd896c2c18c4ac8f9aa4b110197eb4a19f774f1dce6895d'

def plain(el):
    return ''.join(el.xpath('.//w:t/text() | .//m:t/text()', namespaces=NS))

def math(el):
    tag = E.QName(el).localname
    if tag.endswith('Pr'): return ''
    if tag == 'rad':
        degree = el.find('m:deg', NS)
        d = math(degree) if degree is not None else ''
        return r'\sqrt' + ('['+d+']' if d else '') + '{'+math(el.find('m:e',NS))+'}'
    if tag == 't': return el.text or ''
    if tag == 'f': return r'\frac{'+math(el.find('m:num',NS))+'}{'+math(el.find('m:den',NS))+'}'
    if tag in ('sSub','sSup'):
        sub = 'sub' if tag == 'sSub' else 'sup'
        return '{'+math(el.find('m:e',NS))+'}'+('_' if sub == 'sub' else '^')+'{'+math(el.find('m:'+sub,NS))+'}'
    if tag not in ('oMath','oMathPara','r','e','deg','num','den','sub','sup'):
        raise ValueError('Unsupported source math: '+tag)
    return ''.join(math(c) for c in el)

def escape(text):
    return re.sub(r'([\\*_{}\[\]|`~])', r'\\\1', text).replace('<','&lt;').replace('>','&gt;')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('source',type=Path); args=ap.parse_args()
    if hashlib.sha256(args.source.read_bytes()).hexdigest()!=SOURCE_SHA256:
        raise SystemExit('This fixed selection only applies to the verified SST source revision')
    if (SAMPLE/'page.mdx').exists(): raise SystemExit('page.mdx already exists; refusing to overwrite edits')
    SAMPLE.mkdir(parents=True,exist_ok=True)
    z=ZipFile(args.source)
    rels={r.get('Id'):r.get('Target') for r in E.fromstring(z.read('word/_rels/document.xml.rels'))}
    body=E.fromstring(z.read('word/document.xml')).find('w:body',NS)
    def inline(el):
        out=''
        for c in el:
            name=E.QName(c).localname
            if name in ('oMath','oMathPara'): out+='$'+math(c)+'$'
            elif name == 'r':
                t=''.join(c.xpath('w:t/text()',namespaces=NS))
                t=escape(t)
                out+=t
                if c.find('w:br',NS) is not None: out+=' '
            elif name == 'hyperlink':
                text=inline(c); target=rels.get(c.get('{'+NS['r']+'}id'),'')
                out+=f'[{text}]({target})' if target.startswith(('http://','https://')) else text
        return out
    image_files=[]
    def paragraph(el,index):
        image=el.find('.//a:blip',NS)
        if image is not None:
            target=rels[image.get('{'+NS['r']+'}embed')]
            name=Path(target).name
            (SAMPLE/name).write_bytes(z.read('word/'+target))
            image_files.append(name)
            return f'![{plain(body[index+1])}](./{name})'
        text=inline(el).strip()
        if not text: return ''
        style=el.find('w:pPr/w:pStyle',NS)
        s=style.get('{'+NS['w']+'}val','') if style is not None else ''
        # The selected report stores heading levels as built-in numeric style IDs.
        if re.match(r'^\d+\.\d+\s|^[AC]\.\d+\s',plain(el)): return '### '+text
        if re.match(r'^\d+\.\s|^附录 ',plain(el)): return '## '+text
        if text.startswith('• '): return '- '+text[2:]
        return text
    def table(el):
        rows=[]
        for row in el.findall('w:tr',NS):
            cells=[' '.join(inline(p).strip() for p in c.findall('w:p',NS)) for c in row.findall('w:tc',NS)]
            rows.append('| '+' | '.join(cells)+' |')
        rows.insert(1,'| '+' | '.join(['---']*len(el.find('w:tr',NS).findall('w:tc',NS)))+' |')
        return '\n'.join(rows)
    groups=[
        ('topology','总体拓扑与单元参数',list(range(97,111))),
        ('dab','DAB 模块设计',list(range(144,158))),
        ('margin','设计余量',list(range(224,227))),
        ('vendors','国内产品参数对比',[432,433]),
        ('modulation','调制度计算与图解',list(range(467,480))),
        ('calculation','设计参数核算',list(range(529,534))),
    ]
    chunks=['export const meta = { title: "10 kV 直挂 SST 报告试验" }','',
            '# 10 kV 直挂 SST 系统设计方案','',
            '1.25 MW · CHB + DAB · 技术报告节选','']
    provenance=[]
    for key,title,indices in groups:
        chunks+=['',f'{{/* section:{key} */}}','',f'## {title}','']
        skip=set()
        for i in indices:
            if i in skip: continue
            el=body[i]
            if i==100:
                chunks+=['```text','\n'.join(plain(body[j]) for j in range(100,104)),'```','']
                skip.update(range(101,104)); continue
            if i==471:
                chunks+=['$$',r'V_{\mathrm{ph}}=\frac{N m V_{\mathrm{bus}}}{\sqrt{2}}\quad\Longrightarrow\quad m=\frac{\sqrt{2}V_{\mathrm{ph}}}{N V_{\mathrm{bus}}}','$$','']
                continue
            if i==150:
                chunks+=[r'按 SPS 最大传输功率（$D=0.5$），取变比 $n\approx V_1/V_2$：','',
                         '$$',r'P_{\max}=\frac{n V_1 V_2}{8 f_s L}','$$','']
                continue
            # Avoid repeating the original top-level heading directly below the sample section title.
            if i in (97,144,224,529): continue
            chunks += [table(el) if E.QName(el).localname=='tbl' else paragraph(el,i),'']
        provenance.append({'id':key,'bodyIndices':indices})
    content='\n'.join(chunks)
    (SAMPLE/'page.mdx').write_text(content,encoding='utf-8')
    layout={'title':'10 kV 直挂 SST 系统设计方案','subtitle':'1.25 MW · CHB + DAB · 技术报告节选',
      'font':'仿宋','size':12,'marginsMm':{'top':25.4,'bottom':25.4,'left':23,'right':22},
      'header':'10 kV 直挂型 SST 系统设计报告',
      'sections':{'vendors':{'orientation':'landscape'},'calculation':{'pageBreak':True}},
      'tableWidthsMm':[[45,60,60],[48,117],[47,29.5,29.5,29.5,29.5],[30,35,30,25,45],[40,40,30,23,35,84],[43,82,40]],
      'imageMaxHeightMm':88}
    (SAMPLE/'word-layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (SAMPLE/'source.json').write_text(json.dumps({'sourcePath':str(args.source.resolve()),'sourceSha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),
      'referencePages':[6,7,10,18,19,37,38,42,43,49],'selection':provenance,'images':image_files,
      'transformations':['选择完整段落与表格，因此包含邻页续文','两条完整等价公式从普通文字转为 LaTeX','原公式（2）的手写编号由导出时自动 SEQ 编号取代','选择章节重新组织为节选报告，其余跨章引用保留原文编号']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'sections':len(groups),'images':len(image_files),'characters':len(content)}))

if __name__=='__main__': main()

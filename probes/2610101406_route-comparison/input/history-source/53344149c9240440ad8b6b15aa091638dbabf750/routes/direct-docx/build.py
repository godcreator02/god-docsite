"""Direct DOCX route: python-docx plus explicit OMML, independent of Word/Pandoc math."""
import sys, time, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from document_common import *

def m(tag,*children,**attrs):
    e=element('m:'+tag,**{'m:'+k:v for k,v in attrs.items()})
    for c in children:
        if isinstance(c,str): e.append(m('r',mtext(c)))
        elif isinstance(c,list):
            for item in c: e.append(m('r',mtext(item)) if isinstance(item,str) else item)
        else: e.append(c)
    return e
def mtext(text):
    e=element('m:t'); e.text=text; return e
def run(t,roman=False,bold=False):
    if roman or bold: return m('r',m('rPr',m('sty',val='b' if bold else 'p')),mtext(t))
    return m('r',mtext(t))
def sub(a,b): return m('sSub',m('e',a),m('sub',b))
def sup(a,b): return m('sSup',m('e',a),m('sup',b))
def subsup(a,b,c): return m('sSubSup',m('e',a),m('sub',b),m('sup',c))
def frac(a,b): return m('f',m('num',a),m('den',b))
def matrix(rows): return m('m',*[m('mr',*[m('e',c) for c in row]) for row in rows])
def delim(start,end,e): return m('d',m('dPr',m('begChr',val=start),m('endChr',val=end)),m('e',e))
def formula(i):
    if i=='eq-inline': nodes=[sub('i','L'),'(t)=',sub('I','0'),'+Δi',m('func',m('fName',run('sin',roman=True)),m('e','(ωt)'))]
    elif i=='eq-fraction': nodes=['H(s)=',frac('1',['LC',sup('s','2'),'+RCs+1'])]
    elif i=='eq-integral': nodes=['E=',m('nary',m('naryPr',m('chr',val='∫'),m('limLoc',val='subSup')),m('sub','0'),m('sup','T'),m('e','v(t)i(t)',run('d',roman=True),'t'))]
    elif i=='eq-matrix': nodes=[run('A',bold=True),'=',delim('[',']',matrix([['0','1'],[['−',subsup('ω','0','2')],['−2ζ',sub('ω','0')]]]))]
    elif i=='eq-cases': nodes=['u(t)=',delim('{','',matrix([[[sub('U',run('dc',roman=True)),','],'t≥0'],['0,','t<0']]))]
    elif i=='eq-aligned': nodes=[m('eqArr',m('e',sub('v','L'),'=L',frac([run('d',roman=True),sub('i','L')],[run('d',roman=True),'t'])),m('e',sub('i','C'),'=C',frac([run('d',roman=True),sub('v','C')],[run('d',roman=True),'t'])))]
    else: raise ValueError(i)
    return m('oMath',*nodes)

def build(out):
    start=time.perf_counter(); d=styled_document(); cover(d)
    d.add_heading('一、'+FIXTURE['headings'][0]['text'],1)
    d.add_paragraph(FIXTURE['paragraphs'][0]['text'])
    p=d.add_paragraph(); p.add_run(FIXTURE['paragraphs'][1]['textBeforeEquation']); p._p.append(formula('eq-inline')); p.add_run(FIXTURE['paragraphs'][1]['textAfterEquation'])
    p=d.add_paragraph('参见表 '); field(p._p,' REF TableParameters \\h '); p.add_run(' 和式（'); field(p._p,' REF EqFraction \\h '); p.add_run('）。'+FIXTURE['paragraphs'][2]['text'])
    d.add_heading('二、'+FIXTURE['headings'][1]['text'],1)
    for n,e in enumerate(FIXTURE['equations'][1:],1):
        if n==3:d.add_heading('（一）'+FIXTURE['headings'][2]['text'],2)
        p=d.add_paragraph(style='Equation'); p.add_run('\t'); p._p.append(formula(e['id'])); p.add_run('\t（')
        field(p._p,' SEQ Equation \\* ARABIC ',str(n),('21','EqFraction') if n==1 else None); p.add_run('）')
    d.add_page_break(); d.add_heading('三、'+FIXTURE['headings'][3]['text'],1); parameter_table(d)
    d.save(out/'direct-docx.raw.docx')
    (out/'direct-docx-generation.json').write_text(json.dumps({'seconds':time.perf_counter()-start,'math':'explicit OMML tree','pythonDocx':__import__('docx').__version__},indent=2),encoding='utf-8')

if __name__=='__main__': build(Path(sys.argv[1]))
